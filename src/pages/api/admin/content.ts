import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { applyContentAction, type ContentAction } from '../../../server/content/service';
import { errorResponse, requireAdmin } from '../../../server/admin/http';

export const prerender = false;

const ACTIONS: ContentAction[] = ['save', 'submit', 'publish', 'unpublish', 'move-up', 'move-down'];

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const admin = requireAdmin(locals, 'content.view');
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action as ContentAction;
    if (!ACTIONS.includes(action)) return Response.json({ error: 'Unknown action.' }, { status: 400 });

    const result = await applyContentAction(admin, { db: env.DB, deployHookUrl: env.DEPLOY_HOOK_URL }, {
      action,
      collection: String(body.collection ?? ''),
      key: typeof body.key === 'string' ? body.key : null,
      data: body.data,
      ...(typeof body.rowVersion === 'number' ? { rowVersion: body.rowVersion } : {}),
    });
    if (!result.ok) return Response.json({ error: result.error, issues: result.issues ?? [] }, { status: result.status });
    return Response.json({ entry: result.entry, issues: result.issues, rebuild: result.rebuild ?? null });
  } catch (error) {
    return errorResponse(error);
  }
};
