import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { SessionStore, clearSessionCookie, sessionToken } from '../../server/admin/sessions';

export const prerender = false;

// Signs out: the session is revoked on the server, so the old cookie can never be reused.
// If Cloudflare Access is in use, its session is ended too.
export const GET: APIRoute = async ({ url, request }) => {
  await new SessionStore(env.DB).revokeToken(sessionToken(request));
  const location = env.ACCESS_TEAM_DOMAIN ? '/cdn-cgi/access/logout' : '/auth/login?reason=signed-out';
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Set-Cookie': clearSessionCookie(url.protocol === 'https:'), 'Cache-Control': 'no-store' },
  });
};
