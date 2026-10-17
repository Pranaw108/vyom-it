import { describe, expect, it } from 'vitest';
import type { LeadData } from '../../src/lib/leads/validation';
import type { Mailer, MailMessage, MailResult } from '../../src/server/mail/mailer';
import type { Channel, LeadStore, StoredLead } from '../../src/server/leads/store';
import { MAX_EMAIL_ATTEMPTS, deliverLeadEmails, retryLeadEmails, submitLead, type LeadDeps } from '../../src/server/leads/service';

// In-memory store that mimics the D1 claim semantics, so the service logic can be tested without a database.
class MemoryStore implements LeadStore {
  leads = new Map<number, StoredLead & { status: Record<Channel, string>; attempts: Record<Channel, number>; claimedAt: Record<Channel, string> }>();
  attempts: { ipHash: string; at: string }[] = [];
  failInsert = false;
  private nextId = 1;

  async countRecentAttempts(ipHash: string, since: string) {
    return this.attempts.filter((a) => a.ipHash === ipHash && a.at >= since).length;
  }
  async recordAttempt(ipHash: string) {
    this.attempts.push({ ipHash, at: new Date().toISOString() });
  }
  async insert(lead: LeadData) {
    if (this.failInsert) throw new Error('D1 unavailable');
    const existing = [...this.leads.values()].find((l) => l.submissionId === lead.submissionId);
    if (existing) return { id: existing.id, createdAt: existing.createdAt, duplicate: true };
    const id = this.nextId++;
    const createdAt = new Date().toISOString();
    this.leads.set(id, { ...lead, id, createdAt, status: { notify: 'pending', ack: 'pending' }, attempts: { notify: 0, ack: 0 }, claimedAt: { notify: '', ack: '' } });
    return { id, createdAt, duplicate: false };
  }
  async get(id: number) {
    return this.leads.get(id) ?? null;
  }
  async claim(id: number, channel: Channel, max: number) {
    const lead = this.leads.get(id)!;
    if (!['pending', 'failed'].includes(lead.status[channel]) || lead.attempts[channel] >= max) return false;
    lead.status[channel] = 'sending';
    lead.attempts[channel]++;
    lead.claimedAt[channel] = new Date().toISOString();
    return true;
  }
  async markResult(id: number, channel: Channel, ok: boolean, max: number) {
    const lead = this.leads.get(id)!;
    lead.status[channel] = ok ? 'sent' : lead.attempts[channel] >= max ? 'gave_up' : 'failed';
  }
  async skipAck(id: number) {
    this.leads.get(id)!.status.ack = 'skipped';
  }
  async findRetryable(channel: Channel, _stale: string, max: number) {
    return [...this.leads.values()].filter((l) => l.status[channel] === 'failed' && l.attempts[channel] < max).map((l) => l.id);
  }
  async pruneAttempts() {}
  async eraseOlderThan() {
    return 0;
  }
}

class FakeMailer implements Mailer {
  sent: MailMessage[] = [];
  failing = false;
  async send(message: MailMessage): Promise<MailResult> {
    if (this.failing) return { ok: false, error: 'provider down' };
    this.sent.push(message);
    return { ok: true };
  }
}

function setup() {
  const store = new MemoryStore();
  const mailer = new FakeMailer();
  let human = true;
  const deps: LeadDeps = {
    store,
    mailer,
    verifyHuman: async () => human,
    hashIp: async (ip) => (ip ? `hash-${ip}` : null),
    config: { notifyTo: ['founders@example.com'], ackEnabled: true, replyTime: 'within 1 working day', companyName: 'Vyom IT', siteUrl: 'https://example.com' },
  };
  return { store, mailer, deps, setHuman: (v: boolean) => (human = v) };
}

const body = (overrides: Record<string, unknown> = {}) => ({
  formType: 'contact',
  submissionId: crypto.randomUUID(),
  name: 'Ravi Kumar',
  email: 'ravi@example.in',
  message: 'Please call me about a website for our shop.',
  consentContact: true,
  elapsedMs: 8000,
  turnstileToken: 'token',
  ...overrides,
});

describe('submitLead', () => {
  it('saves a valid lead and returns a reference', async () => {
    const { store, deps } = setup();
    const outcome = await submitLead(body(), '1.2.3.4', deps);
    expect(outcome.kind).toBe('created');
    expect(store.leads.size).toBe(1);
  });

  it('stores a repeated submission only once', async () => {
    const { store, deps } = setup();
    const b = body();
    const a = await submitLead(b, '1.2.3.4', deps);
    const c = await submitLead(b, '1.2.3.4', deps);
    expect(store.leads.size).toBe(1);
    expect(a.kind === 'created' && c.kind === 'created' && a.reference === c.reference && c.duplicate).toBe(true);
  });

  it('rejects when the human check fails and stores nothing', async () => {
    const { store, deps, setHuman } = setup();
    setHuman(false);
    expect((await submitLead(body(), '1.2.3.4', deps)).kind).toBe('not-human');
    expect(store.leads.size).toBe(0);
  });

  it('silently drops honeypot and too-fast submissions', async () => {
    const { store, deps } = setup();
    expect((await submitLead(body({ website: 'spam' }), '1.2.3.4', deps)).kind).toBe('silently-dropped');
    expect((await submitLead(body({ elapsedMs: 100 }), '1.2.3.4', deps)).kind).toBe('silently-dropped');
    expect(store.leads.size).toBe(0);
  });

  it('rate-limits the sixth attempt from one address', async () => {
    const { deps } = setup();
    const kinds = [];
    for (let i = 0; i < 6; i++) kinds.push((await submitLead(body(), '9.9.9.9', deps)).kind);
    expect(kinds.slice(0, 5).every((k) => k === 'created')).toBe(true);
    expect(kinds[5]).toBe('rate-limited');
  });

  it('surfaces a database failure to the caller instead of pretending success', async () => {
    const { store, deps } = setup();
    store.failInsert = true;
    await expect(submitLead(body(), '1.2.3.4', deps)).rejects.toThrow('D1 unavailable');
  });
});

describe('email delivery', () => {
  it('sends one alert and one acknowledgement', async () => {
    const { mailer, deps } = setup();
    const outcome = await submitLead(body(), '1.2.3.4', deps);
    if (outcome.kind !== 'created') throw new Error('expected created');
    await deliverLeadEmails(outcome.leadId, deps);
    expect(mailer.sent.map((m) => m.to[0])).toEqual(['founders@example.com', 'ravi@example.in']);
  });

  it('never sends twice when two deliveries run at the same time', async () => {
    const { mailer, deps } = setup();
    const outcome = await submitLead(body(), '1.2.3.4', deps);
    if (outcome.kind !== 'created') throw new Error('expected created');
    await Promise.all([deliverLeadEmails(outcome.leadId, deps), deliverLeadEmails(outcome.leadId, deps)]);
    expect(mailer.sent.filter((m) => m.to[0] === 'founders@example.com')).toHaveLength(1);
  });

  it('keeps the lead when email fails, then delivers exactly once on retry', async () => {
    const { store, mailer, deps } = setup();
    const outcome = await submitLead(body(), '1.2.3.4', deps);
    if (outcome.kind !== 'created') throw new Error('expected created');
    mailer.failing = true;
    await deliverLeadEmails(outcome.leadId, deps);
    expect(store.leads.get(outcome.leadId)!.status.notify).toBe('failed');
    mailer.failing = false;
    await retryLeadEmails(deps);
    await retryLeadEmails(deps);
    expect(mailer.sent.filter((m) => m.to[0] === 'founders@example.com')).toHaveLength(1);
    expect(store.leads.get(outcome.leadId)!.status.notify).toBe('sent');
  });

  it('gives up after the maximum attempts so the admin can raise an alert', async () => {
    const { store, mailer, deps } = setup();
    const outcome = await submitLead(body(), '1.2.3.4', deps);
    if (outcome.kind !== 'created') throw new Error('expected created');
    mailer.failing = true;
    await deliverLeadEmails(outcome.leadId, deps);
    for (let i = 0; i < MAX_EMAIL_ATTEMPTS + 2; i++) await retryLeadEmails(deps);
    expect(store.leads.get(outcome.leadId)!.status.notify).toBe('gave_up');
    expect(store.leads.get(outcome.leadId)!.attempts.notify).toBe(MAX_EMAIL_ATTEMPTS);
  });

  it('escapes visitor input in the alert email', async () => {
    const { mailer, deps } = setup();
    const outcome = await submitLead(body({ message: '<script>alert(1)</script> hello team' }), '1.2.3.4', deps);
    if (outcome.kind !== 'created') throw new Error('expected created');
    await deliverLeadEmails(outcome.leadId, deps);
    expect(mailer.sent[0]!.html).not.toContain('<script>');
    expect(mailer.sent[0]!.html).toContain('&lt;script&gt;');
  });
});
