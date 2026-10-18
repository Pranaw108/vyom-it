import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { SESSION_COOKIE, cookie } from '../../server/admin/session';

export const prerender = false;

// Signs out of the admin. If Cloudflare Access is in use, its session is ended too.
export const GET: APIRoute = ({ url }) => {
  const location = env.ACCESS_TEAM_DOMAIN ? '/cdn-cgi/access/logout' : '/admin/no-access?reason=signed-out';
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Set-Cookie': cookie(SESSION_COOKIE, '', 0, url.protocol === 'https:'), 'Cache-Control': 'no-store' },
  });
};
