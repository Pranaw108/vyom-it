import type { RedirectStatus } from '../../lib/redirects';

export interface Redirect {
  id: number;
  from: string;
  to: string;
  status: RedirectStatus;
  hits: number;
  lastHitAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

export class RedirectStore {
  constructor(private readonly db: D1Database) {}

  async list(): Promise<Redirect[]> {
    const { results } = await this.db
      .prepare(`SELECT r.*, u.username FROM redirects r LEFT JOIN users u ON u.id = r.created_by ORDER BY r.from_path`)
      .all<Record<string, unknown>>();
    return results.map((r) => ({
      id: r.id as number,
      from: r.from_path as string,
      to: r.to_path as string,
      status: r.status_code as RedirectStatus,
      hits: r.hits as number,
      lastHitAt: (r.last_hit_at as string | null) ?? null,
      createdBy: (r.username as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  }

  /** from → to for every redirect; used to refuse loops. */
  async map(): Promise<Map<string, string>> {
    const { results } = await this.db.prepare('SELECT from_path, to_path FROM redirects').all<{ from_path: string; to_path: string }>();
    return new Map(results.map((r) => [r.from_path, r.to_path]));
  }

  /** The one lookup visitors trigger, and only for addresses with no page. */
  async find(path: string): Promise<{ id: number; to: string; status: RedirectStatus } | null> {
    const row = await this.db.prepare('SELECT id, to_path, status_code FROM redirects WHERE from_path = ?').bind(path).first<{ id: number; to_path: string; status_code: RedirectStatus }>();
    return row ? { id: row.id, to: row.to_path, status: row.status_code } : null;
  }

  async recordHit(id: number): Promise<void> {
    await this.db.prepare('UPDATE redirects SET hits = hits + 1, last_hit_at = ? WHERE id = ?').bind(new Date().toISOString(), id).run();
  }

  createStatement(from: string, to: string, status: RedirectStatus, userId: number) {
    return this.db.prepare('INSERT INTO redirects (from_path, to_path, status_code, created_by) VALUES (?, ?, ?, ?)').bind(from, to, status, userId);
  }

  deleteStatement(id: number) {
    return this.db.prepare('DELETE FROM redirects WHERE id = ?').bind(id);
  }

  async get(id: number): Promise<Redirect | null> {
    if (!Number.isInteger(id)) return null;
    return (await this.list()).find((r) => r.id === id) ?? null;
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    return this.db.batch(statements);
  }
}
