import type { Role } from './permissions';

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  status: 'active' | 'disabled';
  createdAt: string;
  lastSeenAt: string | null;
}

const toUser = (r: Record<string, unknown>): AdminUser => ({
  id: r.id as number,
  email: r.email as string,
  name: r.name as string,
  role: r.role as Role,
  status: r.status as AdminUser['status'],
  createdAt: r.created_at as string,
  lastSeenAt: (r.last_seen_at as string | null) ?? null,
});

export class UserStore {
  constructor(private readonly db: D1Database) {}

  async findByEmail(email: string): Promise<AdminUser | null> {
    const row = await this.db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<Record<string, unknown>>();
    return row ? toUser(row) : null;
  }

  async list(): Promise<AdminUser[]> {
    const { results } = await this.db.prepare('SELECT * FROM users ORDER BY status, role, name').all<Record<string, unknown>>();
    return results.map(toUser);
  }

  async count(): Promise<number> {
    return (await this.db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())?.n ?? 0;
  }

  async activeOwnerCount(): Promise<number> {
    return (await this.db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND status = 'active'`).first<{ n: number }>())?.n ?? 0;
  }

  async create(email: string, name: string, role: Role, invitedBy: number | null): Promise<AdminUser> {
    const row = await this.db
      .prepare('INSERT INTO users (email, name, role, invited_by) VALUES (?, ?, ?, ?) RETURNING *')
      .bind(email.toLowerCase(), name, role, invitedBy)
      .first<Record<string, unknown>>();
    if (!row) throw new Error('User insert returned no row');
    return toUser(row);
  }

  async update(id: number, patch: { role?: Role; status?: AdminUser['status'] }): Promise<void> {
    if (patch.role) await this.db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(patch.role, id).run();
    if (patch.status) await this.db.prepare('UPDATE users SET status = ? WHERE id = ?').bind(patch.status, id).run();
  }

  async get(id: number): Promise<AdminUser | null> {
    const row = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<Record<string, unknown>>();
    return row ? toUser(row) : null;
  }

  async touch(id: number): Promise<void> {
    await this.db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(new Date().toISOString(), id).run();
  }
}
