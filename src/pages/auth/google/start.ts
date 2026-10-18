import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { googleAuthUrl } from '../../../server/admin/google';
import { cookie, signValue } from '../../../server/admin/session';

export const prerender = false;

export const OAUTH_COOKIE = 'vyom_oauth';

const random = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');

// Starts "Sign in with Google". state guards against forged callbacks; nonce ties the ID token to this request.
export const GET: APIRoute = async ({ url }) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) {
    return Response.redirect(new URL('/admin/no-access?reason=not-configured', url), 302);
  }
  const state = random();
  const nonce = random();
  const pending = await signValue(env.SESSION_SECRET, { state, nonce, exp: Date.now() + 10 * 60_000 });
  const target = googleAuthUrl(
    { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: `${url.origin}/auth/google/callback` },
    state,
    nonce,
  );
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Set-Cookie': cookie(OAUTH_COOKIE, pending, 600, url.protocol === 'https:', '/auth'),
      'Cache-Control': 'no-store',
    },
  });
};
