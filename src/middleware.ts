import { defineMiddleware } from 'astro:middleware';
import { resolveAdmin } from './server/admin/context';
import { isSameOrigin, verifyCsrfToken } from './server/admin/csrf';

const ADMIN_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
};

const isAdminPath = (path: string) => path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/');

// Guards every admin page and admin API call. Public pages pass straight through.
export const onRequest = defineMiddleware(async (context, next) => {
  if (!isAdminPath(context.url.pathname)) return next();

  const { env } = await import('cloudflare:workers');
  const resolution = await resolveAdmin(context.request, env);
  const isApi = context.url.pathname.startsWith('/api/admin/');

  if (!resolution.ok) {
    if (isApi) {
      await drain(context.request);
      return withHeaders(Response.json({ error: resolution.reason }, { status: resolution.reason === 'signed-out' ? 401 : 403 }));
    }
    context.locals.adminDenied = resolution;
    if (context.url.pathname !== '/admin/no-access') return withHeaders(context.redirect('/admin/no-access', 302));
    return withHeaders(await next());
  }

  // Every state-changing request must come from this site and carry this user's CSRF token.
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    const token = context.request.headers.get('X-CSRF-Token') ?? (await formToken(context.request));
    const valid = isSameOrigin(context.request) && (await verifyCsrfToken(env.CSRF_SECRET, resolution.admin.user.email, token));
    if (!valid) {
      await drain(context.request);
      return withHeaders(Response.json({ error: 'csrf' }, { status: 403 }));
    }
  }

  context.locals.admin = resolution.admin;
  return withHeaders(await next());
});

/** Reads small rejected bodies so every request completes cleanly before we answer. */
async function drain(request: Request) {
  if (Number(request.headers.get('Content-Length') ?? 0) <= 1_000_000) await request.arrayBuffer().catch(() => {});
}

async function formToken(request: Request): Promise<string | null> {
  const type = request.headers.get('Content-Type') ?? '';
  if (!type.includes('form')) return null;
  const value = (await request.clone().formData()).get('_csrf');
  return typeof value === 'string' ? value : null;
}

function withHeaders(response: Response): Response {
  const result = new Response(response.body, response);
  for (const [k, v] of Object.entries(ADMIN_HEADERS)) result.headers.set(k, v);
  return result;
}
