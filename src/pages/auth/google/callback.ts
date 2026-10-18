import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { finishGoogleSignIn } from '../../../server/admin/google';
import { SESSION_COOKIE, SESSION_HOURS, cookie, createSession, readCookie, readSignedValue } from '../../../server/admin/session';
import { UserStore } from '../../../server/admin/users';
import { AuditLog } from '../../../server/admin/audit';
import { hashIp } from '../../../server/security/hash';
import { OAUTH_COOKIE } from './start';

export const prerender = false;

export const GET: APIRoute = async ({ url, request }) => {
  const secure = url.protocol === 'https:';
  const clearPending = cookie(OAUTH_COOKIE, '', 0, secure, '/auth');
  const fail = (reason: string, detail?: string) => {
    if (detail) console.warn(`google sign-in refused: ${detail}`);
    return new Response(null, {
      status: 302,
      headers: { Location: `/admin/no-access?reason=${reason}`, 'Set-Cookie': clearPending, 'Cache-Control': 'no-store' },
    });
  };

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) return fail('not-configured');
  if (url.searchParams.get('error')) return fail('cancelled');

  const pending = await readSignedValue<{ state: string; nonce: string; exp: number }>(env.SESSION_SECRET, readCookie(request, OAUTH_COOKIE));
  const code = url.searchParams.get('code');
  if (!pending || !code || url.searchParams.get('state') !== pending.state) return fail('expired', 'state missing, expired or mismatched');

  const result = await finishGoogleSignIn(
    { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: `${url.origin}/auth/google/callback` },
    code,
    pending.nonce,
  );
  if ('error' in result) return fail('failed', result.error);

  const user = await new UserStore(env.DB).findByEmail(result.email);
  if (user?.status === 'active') {
    const ipHash = await hashIp(request.headers.get('CF-Connecting-IP'), env.IP_HASH_SALT);
    await new AuditLog(env.DB).record({ id: user.id, email: user.email, ipHash }, 'auth.signin', 'user', user.id, 'Signed in with Google');
  }

  // The session only proves who this is; /admin still checks the users table on every request.
  const headers = new Headers({ Location: '/admin', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', clearPending);
  headers.append('Set-Cookie', cookie(SESSION_COOKIE, await createSession(env.SESSION_SECRET, result.email), SESSION_HOURS * 3600, secure));
  return new Response(null, { status: 302, headers });
};
