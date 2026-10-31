import { isReserved, normalisePath, redirectLocation } from '../../lib/redirects';
import { RedirectStore } from './store';

/**
 * Answers a request with a redirect if an Owner set one up for this address.
 * The Worker only runs when no static page matched, so existing pages never pay for this lookup.
 */
export async function serveRedirect(request: Request, db: D1Database, ctx: ExecutionContext): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = normalisePath(url.pathname);
  if (!path || isReserved(path)) return null;

  const store = new RedirectStore(db);
  let match: Awaited<ReturnType<RedirectStore['find']>>;
  try {
    match = await store.find(path);
  } catch (error) {
    // A database problem must never take the site down: carry on to the normal page or 404.
    console.error('redirect lookup failed', error);
    return null;
  }
  if (!match) return null;

  ctx.waitUntil(store.recordHit(match.id).catch((error) => console.error('redirect hit not recorded', error)));
  return new Response(null, {
    status: match.status,
    headers: { Location: redirectLocation(match.to, url.search), 'Cache-Control': match.status === 301 ? 'public, max-age=3600' : 'no-store' },
  });
}
