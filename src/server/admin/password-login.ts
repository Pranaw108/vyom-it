import { AuditLog } from './audit';
import { LoginLimiter } from './login-limit';
import { DUMMY_HASH, hashPassword, needsRehash, verifyPassword } from './password';
import { UserStore, type AdminUser } from './users';

export type LoginResult = { ok: true; user: AdminUser } | { ok: false; message: string; status: number };

// One message for every wrong username/password combination, so the form never reveals which accounts exist.
const WRONG = 'That username and password combination is not right. Check both and try again.';

/** Checks a username and password with rate limiting. Always does one full password check, even for unknown users. */
export async function attemptPasswordLogin(env: Env, ipHash: string | null, rawUsername: string, password: string): Promise<LoginResult> {
  const username = rawUsername.trim().toLowerCase().slice(0, 64);
  if (!username || !password || password.length > 128) return { ok: false, message: 'Enter your username and password.', status: 400 };
  if (!env.PASSWORD_PEPPER) {
    console.error('password login refused: PASSWORD_PEPPER is not configured');
    return { ok: false, message: 'Password sign-in is not set up yet. Use Sign in with Google, or ask the site owner.', status: 503 };
  }

  const limiter = new LoginLimiter(env.DB);
  const allowed = await limiter.allowed(username, ipHash);
  if (!allowed.ok) {
    return { ok: false, message: `Too many attempts. For your security, wait ${allowed.retryMinutes} minutes and try again.`, status: 429 };
  }

  const users = new UserStore(env.DB);
  const user = await users.findByUsername(username);
  const stored = user ? await users.passwordHash(user.id) : null;
  // Compare against a dummy hash when there is no real one, so timing is the same either way.
  const matches = await verifyPassword(password, stored ?? DUMMY_HASH, env.PASSWORD_PEPPER);
  const success = Boolean(user && stored && matches && user.status === 'active');
  await limiter.record(username, ipHash, success);

  if (!success) {
    if (user && stored && matches && user.status !== 'active') {
      return { ok: false, message: 'This account has been turned off. Contact the site owner.', status: 403 };
    }
    if (user) await new AuditLog(env.DB).record({ id: user.id, email: user.username, ipHash }, 'auth.failed', 'user', user.id, 'Wrong password');
    return { ok: false, message: WRONG, status: 401 };
  }

  // Older hashes are upgraded transparently after a successful sign-in.
  if (needsRehash(stored)) await users.setPasswordHash(user!.id, await hashPassword(password, env.PASSWORD_PEPPER));
  return { ok: true, user: user! };
}
