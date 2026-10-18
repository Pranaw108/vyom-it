import { defineMiddleware } from 'astro:middleware';
import type { APIContext, MiddlewareNext } from 'astro';
import { resolveAdmin } from './server/admin/context';
import { isSameOrigin, verifyCsrfToken } from './server/admin/csrf';

// Same headers as public/_headers, for responses the Worker renders (admin, API, images).
const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

const ADMIN_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'same-origin',
};

const isAdminPath = (path: string) => path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/');

export const onRequest = defineMiddleware(async (context, next) => {
  // Prerendered pages get their headers from public/_headers at the edge.
  if (context.isPrerendered) return next();
  const admin = isAdminPath(context.url.pathname);
  const response = admin ? await guardAdmin(context, next) : await next();
  return withHeaders(response, admin ? { ...SECURITY_HEADERS, ...ADMIN_HEADERS } : SECURITY_HEADERS);
});

/** Guards every admin page and admin API call: signed in, active account, and CSRF-safe changes. */
async function guardAdmin(context: APIContext, next: MiddlewareNext): Promise<Response> {
  const { env } = await import('cloudflare:workers');
  const resolution = await resolveAdmin(context.request, env);
  const isApi = context.url.pathname.startsWith('/api/admin/');

  if (!resolution.ok) {
    if (isApi) {
      await drain(context.request);
      return Response.json({ error: resolution.reason }, { status: resolution.reason === 'signed-out' ? 401 : 403 });
    }
    // Signed-out visitors go to the login page; signed-in people without access see why.
    if (resolution.reason === 'signed-out' && context.url.pathname !== '/admin/no-access') {
      return context.redirect(`/auth/login?next=${encodeURIComponent(context.url.pathname)}`, 302);
    }
    context.locals.adminDenied = resolution;
    if (context.url.pathname !== '/admin/no-access') return context.redirect('/admin/no-access', 302);
    return next();
  }

  // Every state-changing request must come from this site and carry this user's CSRF token.
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    const token = context.request.headers.get('X-CSRF-Token') ?? (await formToken(context.request));
    const valid = isSameOrigin(context.request) && (await verifyCsrfToken(env.CSRF_SECRET, `user:${resolution.admin.user.id}`, token));
    if (!valid) {
      await drain(context.request);
      return Response.json({ error: 'csrf' }, { status: 403 });
    }
  }

  context.locals.admin = resolution.admin;
  return next();
}

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

function withHeaders(response: Response, headers: Record<string, string>): Response {
  const result = new Response(response.body, response);
  for (const [k, v] of Object.entries(headers)) result.headers.set(k, v);
  // frame-ancestors only works as a header. Astro sends on-demand pages' CSP as a header, so extend it.
  const csp = result.headers.get('Content-Security-Policy');
  result.headers.set('Content-Security-Policy', csp ? `${csp.replace(/;\s*$/, '')}; frame-ancestors 'none'` : "frame-ancestors 'none'");
  return result;
}
