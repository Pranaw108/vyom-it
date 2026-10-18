import { AuditLog } from './audit';
import { hashIp } from '../security/hash';
import { SessionStore, sessionCookie, type SessionMethod } from './sessions';
import type { AdminUser } from './users';

/** Starts a server-side session for a verified user and records the sign-in. Returns the Set-Cookie value. */
export async function startSession(env: Env, request: Request, user: AdminUser, method: SessionMethod): Promise<string> {
  const ipHash = await hashIp(request.headers.get('CF-Connecting-IP'), env.IP_HASH_SALT);
  const token = await new SessionStore(env.DB).create(user.id, method, { ipHash, userAgent: request.headers.get('User-Agent') });
  await new AuditLog(env.DB).record({ id: user.id, email: user.username, ipHash }, 'auth.signin', 'user', user.id, method === 'google' ? 'Signed in with Google' : 'Signed in with password');
  return sessionCookie(token, new URL(request.url).protocol === 'https:');
}

/** Only same-site admin paths are allowed after sign-in, so the login page cannot redirect elsewhere. */
export function safeNext(value: string | null | undefined): string {
  return typeof value === 'string' && /^\/admin(\/[\w\-/]*)?$/.test(value) ? value : '/admin';
}

/** Login and setup forms must be posted from this site (blocks login CSRF). */
export function sameSiteForm(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}
