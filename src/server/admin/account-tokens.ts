import { newToken, sha256 } from './sessions';

// One-time links for setting a first password (new accounts) or a new one (reset by an Owner).
// The link contains a random token; the database keeps only its hash. Issuing a new link
// cancels earlier unused links for the same account.

export type TokenPurpose = 'setup' | 'reset';
export const TOKEN_HOURS: Record<TokenPurpose, number> = { setup: 72, reset: 24 };

export class AccountTokens {
  constructor(private readonly db: D1Database) {}

  async issue(userId: number, purpose: TokenPurpose, createdBy: number | null, now = new Date()): Promise<string> {
    const token = newToken();
    const expires = new Date(now.getTime() + TOKEN_HOURS[purpose] * 3_600_000).toISOString();
    await this.db.batch([
      this.db.prepare('UPDATE account_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL').bind(now.toISOString(), userId),
      this.db
        .prepare('INSERT INTO account_tokens (token_hash, user_id, purpose, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(await sha256(token), userId, purpose, createdBy, now.toISOString(), expires),
    ]);
    return token;
  }

  /** Looks up a usable token without consuming it (to show the form). */
  async peek(token: string | null, now = new Date()): Promise<{ userId: number; purpose: TokenPurpose } | null> {
    if (!token || token.length < 40 || token.length > 64) return null;
    const row = await this.db
      .prepare('SELECT user_id, purpose, expires_at, used_at FROM account_tokens WHERE token_hash = ?')
      .bind(await sha256(token))
      .first<{ user_id: number; purpose: TokenPurpose; expires_at: string; used_at: string | null }>();
    if (!row || row.used_at || Date.parse(row.expires_at) <= now.getTime()) return null;
    return { userId: row.user_id, purpose: row.purpose };
  }

  /** Marks the token used. True only for the one request that wins, so a link works exactly once. */
  async consume(token: string, now = new Date()): Promise<boolean> {
    const result = await this.db
      .prepare('UPDATE account_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
      .bind(now.toISOString(), await sha256(token), now.toISOString())
      .run();
    return result.meta.changes === 1;
  }
}
