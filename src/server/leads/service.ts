import { MIN_FILL_MS, leadReference, validateLead, type FieldErrors } from '../../lib/leads/validation';
import type { Mailer } from '../mail/mailer';
import { acknowledgementEmail, notificationEmail } from '../mail/templates';
import type { Channel, LeadStore } from './store';

export const MAX_EMAIL_ATTEMPTS = 5;
export const RATE_LIMIT = { max: 5, windowMinutes: 10 };

export interface LeadConfig {
  notifyTo: string[];
  ackEnabled: boolean;
  replyTime: string;
  companyName: string;
  siteUrl: string;
  ackReplyTo?: string;
}

export interface LeadDeps {
  store: LeadStore;
  mailer: Mailer;
  verifyHuman: (token: string, ip: string | null) => Promise<boolean>;
  hashIp: (ip: string | null) => Promise<string | null>;
  config: LeadConfig;
  now?: () => Date;
}

export type SubmitOutcome =
  | { kind: 'created'; reference: string; leadId: number; duplicate: boolean }
  | { kind: 'silently-dropped' }
  | { kind: 'invalid'; errors: FieldErrors }
  | { kind: 'not-human' }
  | { kind: 'rate-limited' };

/**
 * Accepts one form submission. Order matters: cheap checks first, and the lead is saved
 * before any email is attempted, so an email outage can delay an alert but never lose a lead.
 */
export async function submitLead(body: unknown, ip: string | null, deps: LeadDeps): Promise<SubmitOutcome> {
  const now = deps.now?.() ?? new Date();
  const ipHash = await deps.hashIp(ip);

  if (ipHash) {
    const since = new Date(now.getTime() - RATE_LIMIT.windowMinutes * 60_000).toISOString();
    if ((await deps.store.countRecentAttempts(ipHash, since)) >= RATE_LIMIT.max) return { kind: 'rate-limited' };
    await deps.store.recordAttempt(ipHash);
  }

  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  // Bots fill the hidden field or submit instantly. They get a normal-looking reply and nothing is stored.
  const elapsed = typeof input.elapsedMs === 'number' ? input.elapsedMs : 0;
  if ((typeof input.website === 'string' && input.website.trim() !== '') || elapsed < MIN_FILL_MS) {
    console.warn('lead: dropped as likely bot');
    return { kind: 'silently-dropped' };
  }

  const result = validateLead(input);
  if (!result.ok) return { kind: 'invalid', errors: result.errors };

  const token = typeof input.turnstileToken === 'string' ? input.turnstileToken : '';
  if (!(await deps.verifyHuman(token, ip))) return { kind: 'not-human' };

  const saved = await deps.store.insert(result.data, ipHash);
  return {
    kind: 'created',
    reference: leadReference(saved.id, saved.createdAt),
    leadId: saved.id,
    duplicate: saved.duplicate,
  };
}

/** Sends the team alert and the visitor acknowledgement. Safe to call more than once per lead. */
export async function deliverLeadEmails(leadId: number, deps: LeadDeps): Promise<void> {
  await deliver(leadId, 'notify', deps);
  await deliver(leadId, 'ack', deps);
}

async function deliver(leadId: number, channel: Channel, deps: LeadDeps) {
  const { store, mailer, config } = deps;
  if (channel === 'ack' && !config.ackEnabled) {
    await store.skipAck(leadId);
    return;
  }
  // Claim first, then send: only the caller that wins the claim sends, so no lead is emailed twice.
  if (!(await store.claim(leadId, channel, MAX_EMAIL_ATTEMPTS))) return;

  const lead = await store.get(leadId);
  if (!lead) return;
  const reference = leadReference(lead.id, lead.createdAt);

  if (channel === 'notify' && config.notifyTo.length === 0) {
    console.error(`lead ${leadId}: no LEAD_NOTIFY_TO recipients configured`);
    await store.markResult(leadId, channel, false, MAX_EMAIL_ATTEMPTS, 'no recipients configured');
    return;
  }

  const message =
    channel === 'notify'
      ? notificationEmail(lead, reference, config.notifyTo, new URL(`/admin/leads/${lead.id}`, config.siteUrl).toString(), config.companyName)
      : acknowledgementEmail(lead, reference, config.replyTime, config.companyName, config.ackReplyTo);

  const sent = await mailer.send(message);
  if (!sent.ok) console.error(`lead ${leadId}: ${channel} email failed: ${sent.error}`);
  await store.markResult(leadId, channel, sent.ok, MAX_EMAIL_ATTEMPTS, sent.ok ? undefined : sent.error);
}

/** Scheduled job: retries failed or stuck emails. Returns how many leads were retried. */
export async function retryLeadEmails(deps: LeadDeps): Promise<number> {
  const now = deps.now?.() ?? new Date();
  const staleBefore = new Date(now.getTime() - 5 * 60_000).toISOString();
  const ids = new Set<number>();
  for (const channel of ['notify', 'ack'] as const) {
    for (const id of await deps.store.findRetryable(channel, staleBefore, MAX_EMAIL_ATTEMPTS)) ids.add(id);
  }
  for (const id of ids) await deliverLeadEmails(id, deps);
  return ids.size;
}

/** Scheduled job: applies the retention policy (24 months, client decision Q-21). */
export async function applyRetention(deps: LeadDeps, retentionMonths = 24): Promise<number> {
  const now = deps.now?.() ?? new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - retentionMonths);
  await deps.store.pruneAttempts(new Date(now.getTime() - 24 * 3600_000).toISOString());
  return deps.store.eraseOlderThan(cutoff.toISOString());
}
