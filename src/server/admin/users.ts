import type { Role } from './permissions';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  name: string;
  role: Role;
  /** Granted permissions; only meaningful for the client role. */
  permissions: string[];
  status: 'active' | 'disabled';
  hasPassword: boolean;
  passwordChangedAt: string | null;
  createdAt: string;
  lastSeenAt: string | null;
}

const toUser = (r: Record<string, unknown>): AdminUser => ({
  id: r.id as number,
  username: r.username as string,
  email: r.email as string,
  name: r.name as string,
  // access_role is the real role; the legacy `role` column only holds a least-privilege copy.
  role: r.access_role as Role,
  permissions: JSON.parse((r.permissions as string) || '[]'),
  status: r.status as AdminUser['status'],
  hasPassword: Boolean(r.password_hash),
  passwordChangedAt: (r.password_changed_at as string | null) ?? null,
  createdAt: r.created_at as string,
  lastSeenAt: (r.last_seen_at as string | null) ?? null,
});

/** The legacy role column's CHECK has no 'client'; store the least-privileged value there. */
const legacyRole = (role: Role) => (role === 'client' ? 'viewer' : role);

export class UserStore {
  constructor(private readonly db: D1Database) {}

  async findByEmail(email: string): Promise<AdminUser | null> {
    const row = await this.db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<Record<string, unknown>>();
    return row ? toUser(row) : null;
  }

  async findByUsername(username: string): Promise<AdminUser | null> {
    const row = await this.db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<Record<string, unknown>>();
    return row ? toUser(row) : null;
  }

  /** The stored password hash, read only where a password is being checked. */
  async passwordHash(id: number): Promise<string | null> {
    return (await this.db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(id).first<{ password_hash: string | null }>())?.password_hash ?? null;
  }

  async get(id: number): Promise<AdminUser | null> {
    const row = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<Record<string, unknown>>();
    return row ? toUser(row) : null;
  }

  async list(): Promise<AdminUser[]> {
    const { results } = await this.db.prepare('SELECT * FROM users ORDER BY status, access_role, name').all<Record<string, unknown>>();
    return results.map(toUser);
  }

  async count(): Promise<number> {
    return (await this.db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())?.n ?? 0;
  }

  async activeOwnerCount(): Promise<number> {
    return (await this.db.prepare(`SELECT COUNT(*) AS n FROM users WHERE access_role = 'owner' AND status = 'active'`).first<{ n: number }>())?.n ?? 0;
  }

  async create(input: { username: string; email: string; name: string; role: Role; permissions?: string[]; invitedBy: number | null }): Promise<AdminUser> {
    const row = await this.db
      .prepare('INSERT INTO users (username, email, name, role, access_role, permissions, invited_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *')
      .bind(input.username.toLowerCase(), input.email.toLowerCase(), input.name, legacyRole(input.role), input.role, JSON.stringify(input.permissions ?? []), input.invitedBy)
      .first<Record<string, unknown>>();
    if (!row) throw new Error('User insert returned no row');
    return toUser(row);
  }

  async update(id: number, patch: { role?: Role; status?: AdminUser['status']; permissions?: string[] }): Promise<void> {
    if (patch.role) await this.db.prepare('UPDATE users SET access_role = ?, role = ? WHERE id = ?').bind(patch.role, legacyRole(patch.role), id).run();
    if (patch.status) await this.db.prepare('UPDATE users SET status = ? WHERE id = ?').bind(patch.status, id).run();
    if (patch.permissions) await this.db.prepare('UPDATE users SET permissions = ? WHERE id = ?').bind(JSON.stringify(patch.permissions), id).run();
  }

  async setPasswordHash(id: number, hash: string): Promise<void> {
    await this.db.prepare('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?').bind(hash, new Date().toISOString(), id).run();
  }

  async touch(id: number): Promise<void> {
    await this.db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(new Date().toISOString(), id).run();
  }
}
