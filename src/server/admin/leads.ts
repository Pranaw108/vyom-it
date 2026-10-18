import { leadReference } from '../../lib/leads/validation';
import { AuditLog } from './audit';
import type { AdminContext } from './context';

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost', 'spam'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const PAGE_SIZE = 25;

export interface LeadRow {
  id: number;
  reference: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  formType: 'contact' | 'quote';
  intent: string;
  services: string[];
  status: LeadStatus;
  notifyStatus: string;
  createdAt: string;
  erased: boolean;
}

export interface LeadFilter {
  status?: string;
  formType?: string;
  q?: string;
  page?: number;
}

const toRow = (r: Record<string, unknown>): LeadRow => ({
  id: r.id as number,
  reference: leadReference(r.id as number, r.created_at as string),
  name: r.name as string,
  email: r.email as string,
  phone: r.phone as string | null,
  company: r.company as string | null,
  formType: r.form_type as LeadRow['formType'],
  intent: r.intent as string,
  services: JSON.parse((r.services as string) || '[]'),
  status: r.status as LeadStatus,
  notifyStatus: r.notify_status as string,
  createdAt: r.created_at as string,
  erased: Boolean(r.erased_at),
});

function where(filter: LeadFilter): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.status && (LEAD_STATUSES as readonly string[]).includes(filter.status)) {
    clauses.push('status = ?');
    params.push(filter.status);
  }
  if (filter.formType === 'contact' || filter.formType === 'quote') {
    clauses.push('form_type = ?');
    params.push(filter.formType);
  }
  if (filter.q?.trim()) {
    clauses.push('(name LIKE ? OR email LIKE ? OR company LIKE ?)');
    const like = `%${filter.q.trim().replace(/[%_]/g, '')}%`;
    params.push(like, like, like);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export class LeadAdmin {
  private readonly audit: AuditLog;
  constructor(private readonly db: D1Database) {
    this.audit = new AuditLog(db);
  }

  async list(filter: LeadFilter): Promise<{ rows: LeadRow[]; total: number }> {
    const w = where(filter);
    const page = Math.max(1, filter.page ?? 1);
    const [{ results }, count] = await Promise.all([
      this.db.prepare(`SELECT * FROM leads ${w.sql} ORDER BY id DESC LIMIT ? OFFSET ?`).bind(...w.params, PAGE_SIZE, (page - 1) * PAGE_SIZE).all<Record<string, unknown>>(),
      this.db.prepare(`SELECT COUNT(*) AS n FROM leads ${w.sql}`).bind(...w.params).first<{ n: number }>(),
    ]);
    return { rows: results.map(toRow), total: count?.n ?? 0 };
  }

  async detail(id: number) {
    const lead = await this.db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first<Record<string, unknown>>();
    if (!lead) return null;
    const [events, notes] = await Promise.all([
      this.db.prepare('SELECT event, actor, detail, created_at FROM lead_events WHERE lead_id = ? ORDER BY id DESC').bind(id).all<Record<string, string>>(),
      this.db.prepare('SELECT author_email, body, created_at FROM lead_notes WHERE lead_id = ? ORDER BY id DESC').bind(id).all<Record<string, string>>(),
    ]);
    return { row: toRow(lead), raw: lead, events: events.results, notes: notes.results };
  }

  async stats() {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const row = await this.db
      .prepare(
        `SELECT
           SUM(created_at >= ?) AS last7,
           SUM(status = 'new' AND erased_at IS NULL) AS unanswered,
           SUM(notify_status = 'failed') AS failing,
           SUM(notify_status = 'gave_up') AS gave_up
         FROM leads`,
      )
      .bind(weekAgo)
      .first<Record<string, number | null>>();
    return { last7: row?.last7 ?? 0, unanswered: row?.unanswered ?? 0, failing: row?.failing ?? 0, gaveUp: row?.gave_up ?? 0 };
  }

  async setStatus(admin: AdminContext, id: number, status: LeadStatus): Promise<boolean> {
    const results = await this.db.batch([
      this.db.prepare(`UPDATE leads SET status = ?, updated_at = ? WHERE id = ? AND erased_at IS NULL AND status != ?`).bind(status, new Date().toISOString(), id, status),
      this.db.prepare(`INSERT INTO lead_events (lead_id, event, actor, detail) SELECT ?, 'status_changed', ?, ? WHERE changes() > 0`).bind(id, admin.user.username, `to ${status}`),
      this.audit.statement(admin.actor, 'lead.status', 'lead', id, `Status set to ${status}`),
    ]);
    return Boolean(results[0]?.meta.changes);
  }

  async addNote(admin: AdminContext, id: number, body: string): Promise<void> {
    await this.db.batch([
      this.db.prepare('INSERT INTO lead_notes (lead_id, author_id, author_email, body) SELECT id, ?, ?, ? FROM leads WHERE id = ? AND erased_at IS NULL').bind(admin.user.id, admin.user.username, body, id),
      this.audit.statement(admin.actor, 'lead.note', 'lead', id, 'Internal note added'),
    ]);
  }

  /** Erases personal data for a privacy request (FR-147). The row and its history remain, without personal details. */
  async erase(admin: AdminContext, id: number, reason: string): Promise<boolean> {
    const now = new Date().toISOString();
    const results = await this.db.batch([
      this.db
        .prepare(
          `UPDATE leads SET name = '[erased]', email = '[erased]', phone = NULL, company = NULL, country = NULL, message = '[erased]',
             link = NULL, ip_hash = NULL, referrer = NULL, landing_page = NULL, erased_at = ?, updated_at = ?
           WHERE id = ? AND erased_at IS NULL`,
        )
        .bind(now, now, id),
      this.db.prepare(`INSERT INTO lead_events (lead_id, event, actor, detail) SELECT ?, 'erased', ?, ? WHERE changes() > 0`).bind(id, admin.user.username, reason),
      this.audit.statement(admin.actor, 'lead.erase', 'lead', id, `Personal data erased. Reason: ${reason}`),
      this.db.prepare(`UPDATE lead_notes SET body = '[erased]' WHERE lead_id = ?`).bind(id),
    ]);
    return Boolean(results[0]?.meta.changes);
  }

  async exportCsv(admin: AdminContext, filter: LeadFilter): Promise<string> {
    const w = where(filter);
    const { results } = await this.db.prepare(`SELECT * FROM leads ${w.sql} ORDER BY id DESC LIMIT 5000`).bind(...w.params).all<Record<string, unknown>>();
    const columns = ['reference', 'created_at', 'status', 'form_type', 'intent', 'name', 'email', 'phone', 'company', 'country', 'services', 'project_type', 'platforms', 'timeline', 'budget', 'preferred_contact', 'message', 'link', 'utm_source', 'utm_medium', 'utm_campaign', 'referrer'];
    const lines = [columns.join(',')];
    for (const r of results) {
      const values = columns.map((c) => (c === 'reference' ? leadReference(r.id as number, r.created_at as string) : r[c]));
      lines.push(values.map(csvCell).join(','));
    }
    await this.audit.record(admin.actor, 'lead.export', 'lead', null, `Exported ${results.length} lead(s)`);
    return lines.join('\r\n');
  }
}

/** Quotes a CSV cell and neutralises spreadsheet formulas (CSV injection). */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
