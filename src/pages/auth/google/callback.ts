import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { finishGoogleSignIn } from '../../../server/admin/google';
import { cookie, readCookie, readSignedValue } from '../../../server/admin/session';
import { bootstrapOwner } from '../../../server/admin/context';
import { startSession } from '../../../server/admin/signin';
import { UserStore } from '../../../server/admin/users';
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
      headers: { Location: `/auth/login?reason=${reason}`, 'Set-Cookie': clearPending, 'Cache-Control': 'no-store' },
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

  // Google proves who this is; only an existing, active account (or the very first Owner) gets a session.
  const users = new UserStore(env.DB);
  const ipHash = await hashIp(request.headers.get('CF-Connecting-IP'), env.IP_HASH_SALT);
  const user = (await users.findByEmail(result.email)) ?? (await bootstrapOwner(users, env, result.email, ipHash));
  if (!user) return fail('no-account', `no admin account for ${result.email.replace(/^(.).*@/, '$1***@')}`);
  if (user.status !== 'active') return fail('disabled');

  const headers = new Headers({ Location: '/admin', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', clearPending);
  headers.append('Set-Cookie', await startSession(env, request, user, 'google'));
  return new Response(null, { status: 302, headers });
};
