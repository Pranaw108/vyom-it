import type { LeadData } from '../../lib/leads/validation';

export type Channel = 'notify' | 'ack';

export interface StoredLead extends LeadData {
  id: number;
  createdAt: string;
}

// Storage boundary for leads. Only this file knows about D1, so another database
// can be swapped in by writing one new implementation (see docs/MIGRATION.md).
export interface LeadStore {
  countRecentAttempts(ipHash: string, sinceIso: string): Promise<number>;
  recordAttempt(ipHash: string): Promise<void>;
  /** Inserts the lead, or returns the existing one for a repeated submissionId. */
  insert(lead: LeadData, ipHash: string | null): Promise<{ id: number; createdAt: string; duplicate: boolean }>;
  get(id: number): Promise<StoredLead | null>;
  /** Claims the email job for a lead. True only for the one caller that wins the claim. */
  claim(id: number, channel: Channel, maxAttempts: number): Promise<boolean>;
  markResult(id: number, channel: Channel, ok: boolean, maxAttempts: number, detail?: string): Promise<void>;
  skipAck(id: number): Promise<void>;
  /** Lead ids whose email job should be retried. */
  findRetryable(channel: Channel, staleBeforeIso: string, maxAttempts: number): Promise<number[]>;
  pruneAttempts(beforeIso: string): Promise<void>;
  eraseOlderThan(beforeIso: string): Promise<number>;
}

const now = () => new Date().toISOString();

export class D1LeadStore implements LeadStore {
  constructor(private readonly db: D1Database) {}

  async countRecentAttempts(ipHash: string, sinceIso: string) {
    const row = await this.db
      .prepare('SELECT COUNT(*) AS n FROM lead_attempts WHERE ip_hash = ? AND created_at >= ?')
      .bind(ipHash, sinceIso)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  async recordAttempt(ipHash: string) {
    await this.db.prepare('INSERT INTO lead_attempts (ip_hash, created_at) VALUES (?, ?)').bind(ipHash, now()).run();
  }

  async insert(lead: LeadData, ipHash: string | null) {
    const createdAt = now();
    const inserted = await this.db
      .prepare(
        `INSERT INTO leads (submission_id, form_type, intent, name, email, phone, company, country, message, services,
          project_type, platforms, link, timeline, budget, preferred_contact, consent_contact, consent_marketing,
          consent_version, referrer, utm_source, utm_medium, utm_campaign, landing_page, ip_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (submission_id) DO NOTHING
         RETURNING id, created_at`,
      )
      .bind(
        lead.submissionId, lead.formType, lead.intent, lead.name, lead.email, lead.phone, lead.company, lead.country,
        lead.message, JSON.stringify(lead.services), lead.projectType, lead.platforms, lead.link, lead.timeline,
        lead.budget, lead.preferredContact, lead.consentMarketing ? 1 : 0, lead.consentVersion,
        lead.source.referrer, lead.source.utmSource, lead.source.utmMedium, lead.source.utmCampaign,
        lead.source.landingPage, ipHash, createdAt, createdAt,
      )
      .first<{ id: number; created_at: string }>();

    if (inserted) {
      await this.event(inserted.id, 'created', `form=${lead.formType}`);
      return { id: inserted.id, createdAt: inserted.created_at, duplicate: false };
    }
    const existing = await this.db
      .prepare('SELECT id, created_at FROM leads WHERE submission_id = ?')
      .bind(lead.submissionId)
      .first<{ id: number; created_at: string }>();
    if (!existing) throw new Error('Lead insert returned no row and no existing lead was found');
    return { id: existing.id, createdAt: existing.created_at, duplicate: true };
  }

  async get(id: number): Promise<StoredLead | null> {
    const r = await this.db.prepare('SELECT * FROM leads WHERE id = ? AND erased_at IS NULL').bind(id).first<Record<string, unknown>>();
    if (!r) return null;
    return {
      id: r.id as number,
      createdAt: r.created_at as string,
      formType: r.form_type as LeadData['formType'],
      submissionId: r.submission_id as string,
      intent: r.intent as LeadData['intent'],
      name: r.name as string,
      email: r.email as string,
      phone: r.phone as string | null,
      company: r.company as string | null,
      country: r.country as string | null,
      message: r.message as string,
      services: JSON.parse(r.services as string),
      projectType: r.project_type as LeadData['projectType'],
      platforms: r.platforms as LeadData['platforms'],
      link: r.link as string | null,
      timeline: r.timeline as LeadData['timeline'],
      budget: r.budget as LeadData['budget'],
      preferredContact: r.preferred_contact as LeadData['preferredContact'],
      consentContact: true,
      consentMarketing: r.consent_marketing === 1,
      consentVersion: r.consent_version as string,
      source: {
        referrer: r.referrer as string | null,
        utmSource: r.utm_source as string | null,
        utmMedium: r.utm_medium as string | null,
        utmCampaign: r.utm_campaign as string | null,
        landingPage: r.landing_page as string | null,
      },
    };
  }

  async claim(id: number, channel: Channel, maxAttempts: number) {
    // Column names come from a fixed union, never from user input.
    const result = await this.db
      .prepare(
        `UPDATE leads SET ${channel}_status = 'sending', ${channel}_attempts = ${channel}_attempts + 1,
           ${channel}_claimed_at = ?, updated_at = ?
         WHERE id = ? AND ${channel}_status IN ('pending', 'failed') AND ${channel}_attempts < ?`,
      )
      .bind(now(), now(), id, maxAttempts)
      .run();
    return result.meta.changes === 1;
  }

  async markResult(id: number, channel: Channel, ok: boolean, maxAttempts: number, detail?: string) {
    // After the last allowed attempt a failure becomes 'gave_up', which the admin shows as an alert.
    const status = ok ? `'sent'` : `CASE WHEN ${channel}_attempts >= ?1 THEN 'gave_up' ELSE 'failed' END`;
    await this.db
      .prepare(`UPDATE leads SET ${channel}_status = ${status}, updated_at = ?2 WHERE id = ?3`)
      .bind(maxAttempts, now(), id)
      .run();
    await this.event(id, ok ? `${channel}_sent` : `${channel}_failed`, detail);
  }

  async skipAck(id: number) {
    await this.db.prepare(`UPDATE leads SET ack_status = 'skipped', updated_at = ? WHERE id = ?`).bind(now(), id).run();
  }

  async findRetryable(channel: Channel, staleBeforeIso: string, maxAttempts: number) {
    const { results } = await this.db
      .prepare(
        `SELECT id FROM leads
         WHERE erased_at IS NULL AND ${channel}_attempts < ?
           AND (${channel}_status = 'failed'
             OR (${channel}_status = 'pending' AND created_at < ?)
             OR (${channel}_status = 'sending' AND ${channel}_claimed_at < ?))
         ORDER BY id LIMIT 20`,
      )
      .bind(maxAttempts, staleBeforeIso, staleBeforeIso)
      .all<{ id: number }>();
    // A job stuck in 'sending' (the worker stopped mid-send) is released so it can be claimed again.
    if (results.length) {
      await this.db
        .prepare(`UPDATE leads SET ${channel}_status = 'failed' WHERE ${channel}_status = 'sending' AND ${channel}_claimed_at < ?`)
        .bind(staleBeforeIso)
        .run();
    }
    return results.map((r) => r.id);
  }

  async pruneAttempts(beforeIso: string) {
    await this.db.prepare('DELETE FROM lead_attempts WHERE created_at < ?').bind(beforeIso).run();
  }

  async eraseOlderThan(beforeIso: string) {
    // Retention: personal fields are blanked; the row and its history stay as proof of what happened.
    const result = await this.db
      .prepare(
        `UPDATE leads SET name = '[erased]', email = '[erased]', phone = NULL, company = NULL, country = NULL,
           message = '[erased]', link = NULL, ip_hash = NULL, referrer = NULL, erased_at = ?, updated_at = ?
         WHERE erased_at IS NULL AND created_at < ?`,
      )
      .bind(now(), now(), beforeIso)
      .run();
    return result.meta.changes ?? 0;
  }

  private async event(leadId: number, event: string, detail?: string) {
    await this.db.prepare('INSERT INTO lead_events (lead_id, event, detail) VALUES (?, ?, ?)').bind(leadId, event, detail ?? null).run();
  }
}
