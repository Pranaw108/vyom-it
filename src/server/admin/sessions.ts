import { base64UrlEncode } from './jwt';
import { readCookie } from './session';

// Server-side admin sessions. The browser holds a random token in an HttpOnly cookie; the database
// holds only its SHA-256 hash. Every request looks the session up, so logout, password changes and
// "sign out everywhere" take effect immediately.

export const SESSION_COOKIE = 'vyom_session';
export const SESSION_MAX_HOURS = 12; // absolute lifetime
export const SESSION_IDLE_HOURS = 2; // signed out after this long without activity
const TOUCH_EVERY_MS = 5 * 60_000; // limit writes: refresh last-seen at most every 5 minutes

export type SessionMethod = 'password' | 'google';

export interface ActiveSession {
  tokenHash: string;
  userId: number;
  method: SessionMethod;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
}

export async function sha256(value: string): Promise<string> {
  return base64UrlEncode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

export function newToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export class SessionStore {
  constructor(private readonly db: D1Database) {}

  /** Creates a session and returns the raw token for the cookie (never stored). */
  async create(userId: number, method: SessionMethod, meta: { ipHash: string | null; userAgent: string | null }, now = new Date()): Promise<string> {
    const token = newToken();
    const expires = new Date(now.getTime() + SESSION_MAX_HOURS * 3_600_000);
    await this.db
      .prepare('INSERT INTO sessions (token_hash, user_id, method, created_at, expires_at, last_seen_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(await sha256(token), userId, method, now.toISOString(), expires.toISOString(), now.toISOString(), meta.ipHash, meta.userAgent?.slice(0, 200) ?? null)
      .run();
    return token;
  }

  /** Returns the active session for this cookie token, or null if unknown, revoked, expired or idle. */
  async find(token: string | null, now = new Date()): Promise<ActiveSession | null> {
    if (!token || token.length < 40 || token.length > 64) return null;
    const row = await this.db.prepare('SELECT * FROM sessions WHERE token_hash = ?').bind(await sha256(token)).first<Record<string, string | number | null>>();
    if (!row || row.revoked_at) return null;
    const idleLimit = Date.parse(row.last_seen_at as string) + SESSION_IDLE_HOURS * 3_600_000;
    if (Date.parse(row.expires_at as string) <= now.getTime() || idleLimit <= now.getTime()) return null;
    if (now.getTime() - Date.parse(row.last_seen_at as string) > TOUCH_EVERY_MS) {
      await this.db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').bind(now.toISOString(), row.token_hash).run();
    }
    return {
      tokenHash: row.token_hash as string,
      userId: row.user_id as number,
      method: row.method as SessionMethod,
      createdAt: row.created_at as string,
      lastSeenAt: row.last_seen_at as string,
      expiresAt: row.expires_at as string,
      userAgent: (row.user_agent as string | null) ?? null,
    };
  }

  async revokeToken(token: string | null): Promise<void> {
    if (!token) return;
    await this.db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').bind(new Date().toISOString(), await sha256(token)).run();
  }

  /** Revokes every session of a user, optionally keeping one (the current browser). Returns how many. */
  async revokeAll(userId: number, exceptTokenHash?: string): Promise<number> {
    const result = await this.db
      .prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND token_hash != ?')
      .bind(new Date().toISOString(), userId, exceptTokenHash ?? '')
      .run();
    return result.meta.changes ?? 0;
  }

  async listActive(userId: number, now = new Date()): Promise<ActiveSession[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC LIMIT 20')
      .bind(userId, now.toISOString())
      .all<Record<string, string | number | null>>();
    return results
      .filter((r) => Date.parse(r.last_seen_at as string) + SESSION_IDLE_HOURS * 3_600_000 > now.getTime())
      .map((r) => ({
        tokenHash: r.token_hash as string,
        userId: r.user_id as number,
        method: r.method as SessionMethod,
        createdAt: r.created_at as string,
        lastSeenAt: r.last_seen_at as string,
        expiresAt: r.expires_at as string,
        userAgent: (r.user_agent as string | null) ?? null,
      }));
  }

  /** Daily clean-up of long-dead sessions. */
  async pruneExpired(now = new Date()): Promise<void> {
    const cutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString();
    await this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(cutoff).run();
  }
}

export const sessionToken = (request: Request) => readCookie(request, SESSION_COOKIE);

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_MAX_HOURS * 3600}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
