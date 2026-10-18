// Login rate limiting: a username is locked after repeated failures, and one address cannot
// try many usernames. Successful sign-ins are recorded too, for the audit of access.

export const LIMITS = {
  windowMinutes: 15,
  failuresPerUser: 5,
  failuresPerIp: 20,
};

export class LoginLimiter {
  constructor(private readonly db: D1Database) {}

  private async failures(scope: 'user' | 'ip', key: string, since: string): Promise<number> {
    const row = await this.db
      .prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE scope = ? AND key = ? AND success = 0 AND created_at >= ?')
      .bind(scope, key, since)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  /** Whether this attempt may proceed. Checked before the password is even looked at. */
  async allowed(username: string, ipHash: string | null, now = new Date()): Promise<{ ok: true } | { ok: false; retryMinutes: number }> {
    const since = new Date(now.getTime() - LIMITS.windowMinutes * 60_000).toISOString();
    const [byUser, byIp] = await Promise.all([
      this.failures('user', username.toLowerCase(), since),
      ipHash ? this.failures('ip', ipHash, since) : Promise.resolve(0),
    ]);
    if (byUser >= LIMITS.failuresPerUser || byIp >= LIMITS.failuresPerIp) return { ok: false, retryMinutes: LIMITS.windowMinutes };
    return { ok: true };
  }

  async record(username: string, ipHash: string | null, success: boolean, now = new Date()): Promise<void> {
    const at = now.toISOString();
    const statements = [this.db.prepare('INSERT INTO login_attempts (scope, key, success, created_at) VALUES (?, ?, ?, ?)').bind('user', username.toLowerCase(), success ? 1 : 0, at)];
    if (ipHash) statements.push(this.db.prepare('INSERT INTO login_attempts (scope, key, success, created_at) VALUES (?, ?, ?, ?)').bind('ip', ipHash, success ? 1 : 0, at));
    // A successful sign-in clears that username's failure count.
    if (success) statements.push(this.db.prepare(`DELETE FROM login_attempts WHERE scope = 'user' AND key = ? AND success = 0`).bind(username.toLowerCase()));
    await this.db.batch(statements);
  }

  async prune(now = new Date()): Promise<void> {
    await this.db.prepare('DELETE FROM login_attempts WHERE created_at < ?').bind(new Date(now.getTime() - 86_400_000).toISOString()).run();
  }
}
