import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { AuditLog } from '../../../server/admin/audit';
import { errorResponse, redirectWithMessage, requireAdmin } from '../../../server/admin/http';
import { redirectProblems } from '../../../lib/redirects';
import { RedirectStore } from '../../../server/redirects/store';

export const prerender = false;

const BACK = '/admin/redirects';

/** True if the site still has a page at this address; a redirect there would never be used. */
async function pageExists(origin: string, path: string): Promise<boolean> {
  const response = await env.ASSETS.fetch(new Request(`${origin}${path}`, { method: 'HEAD' }));
  return response.status < 400;
}

// Redirect manager: people who can publish content.
export const POST: APIRoute = async ({ request, locals, url }) => {
  try {
    const admin = requireAdmin(locals, 'content.publish');
    const form = await request.formData();
    const store = new RedirectStore(env.DB);
    const audit = new AuditLog(env.DB);

    if (form.get('action') === 'create') {
      const { from, to, problems } = redirectProblems(String(form.get('from') ?? ''), String(form.get('to') ?? ''), await store.map());
      if (problems.length) return redirectWithMessage(BACK, problems.join(' '), 'error');
      if (await pageExists(url.origin, from!)) {
        return redirectWithMessage(BACK, `${from} is still a live page, so a redirect there would never be used. Take that page offline first.`, 'error');
      }
      const status = form.get('type') === 'temporary' ? 302 : 301;
      await store.batch([store.createStatement(from!, to!, status, admin.user.id), audit.statement(admin.actor, 'redirect.create', 'redirect', from, `${from} → ${to} (${status})`)]);
      return redirectWithMessage(BACK, `Visitors to ${from} now go to ${to}.`);
    }

    if (form.get('action') === 'delete') {
      const target = await store.get(Number(form.get('id')));
      if (!target) return redirectWithMessage(BACK, 'That redirect no longer exists.', 'error');
      await store.batch([store.deleteStatement(target.id), audit.statement(admin.actor, 'redirect.delete', 'redirect', target.from, `${target.from} → ${target.to} removed after ${target.hits} use(s)`)]);
      return redirectWithMessage(BACK, `Redirect from ${target.from} removed.`);
    }

    return redirectWithMessage(BACK, 'Unknown action.', 'error');
  } catch (error) {
    return errorResponse(error, BACK);
  }
};
