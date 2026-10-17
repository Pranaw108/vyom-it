// Append-only audit trail (FR-150). Only INSERT and SELECT exist here, by design.

export interface AuditEntry {
  id: number;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string | null;
  createdAt: string;
}

export interface AuditActor {
  id: number | null;
  email: string;
  ipHash: string | null;
}

export const AUDIT_RETENTION_MONTHS = 24;

export class AuditLog {
  constructor(private readonly db: D1Database) {}

  /**
   * Returns a statement to batch with the change it records. It writes only if the statement
   * just before it changed a row, so a refused (conflicting) update leaves no false audit entry.
   */
  statement(actor: AuditActor, action: string, entity: string, entityId: string | number | null, summary?: string): D1PreparedStatement {
    return this.db
      .prepare(
        `INSERT INTO audit_log (actor_id, actor_email, action, entity, entity_id, summary, ip_hash)
         SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`,
      )
      .bind(actor.id, actor.email, action, entity, entityId === null ? null : String(entityId), summary ?? null, actor.ipHash);
  }

  /** Records an event that is not tied to a preceding change (sign-in, export). */
  async record(actor: AuditActor, action: string, entity: string, entityId: string | number | null, summary?: string) {
    await this.db
      .prepare('INSERT INTO audit_log (actor_id, actor_email, action, entity, entity_id, summary, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(actor.id, actor.email, action, entity, entityId === null ? null : String(entityId), summary ?? null, actor.ipHash)
      .run();
  }

  /** Retention only (scheduled job): entries older than the policy are removed automatically. */
  async purgeExpired(now = new Date()): Promise<number> {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - AUDIT_RETENTION_MONTHS);
    const result = await this.db.prepare('DELETE FROM audit_log WHERE created_at < ?').bind(cutoff.toISOString()).run();
    return result.meta.changes ?? 0;
  }

  async list(filter: { action?: string; entity?: string; limit?: number; offset?: number } = {}): Promise<AuditEntry[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.action) {
      clauses.push('action = ?');
      params.push(filter.action);
    }
    if (filter.entity) {
      clauses.push('entity = ?');
      params.push(filter.entity);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { results } = await this.db
      .prepare(`SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .bind(...params, filter.limit ?? 50, filter.offset ?? 0)
      .all<Record<string, unknown>>();
    return results.map((r) => ({
      id: r.id as number,
      actorEmail: r.actor_email as string,
      action: r.action as string,
      entity: r.entity as string,
      entityId: r.entity_id as string | null,
      summary: r.summary as string | null,
      createdAt: r.created_at as string,
    }));
  }
}
