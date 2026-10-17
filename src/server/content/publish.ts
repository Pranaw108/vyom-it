import type { AdminContext } from '../admin/context';

// Publishing rebuilds the static site through a deploy hook (FR-107). The build reads
// only published content, so visitors never see drafts.

export interface RebuildDeps {
  db: D1Database;
  deployHookUrl: string;
}

export interface PublishJob {
  requestedAt: string;
  hookStatus: 'sent' | 'batched' | 'failed' | 'not_configured';
  detail: string | null;
  requestedBy: string | null;
}

export async function requestRebuild(deps: RebuildDeps, admin: AdminContext): Promise<string> {
  let status: PublishJob['hookStatus'];
  let detail: string | null = null;
  if (!deps.deployHookUrl) {
    status = 'not_configured';
    detail = 'No DEPLOY_HOOK_URL set; run a build manually.';
  } else {
    try {
      const response = await fetch(deps.deployHookUrl, { method: 'POST' });
      status = response.ok ? 'sent' : 'failed';
      if (!response.ok) detail = `Deploy hook responded ${response.status}`;
    } catch (error) {
      status = 'failed';
      detail = `Deploy hook request failed: ${(error as Error).message}`;
    }
  }
  await deps.db
    .prepare('INSERT INTO publish_jobs (requested_by, hook_status, detail) VALUES (?, ?, ?)')
    .bind(admin.user.id, status, detail)
    .run();
  if (status === 'failed') console.error(detail);
  return {
    sent: 'Published. The live site updates in a few minutes.',
    batched: 'Published. The live site updates in a few minutes.',
    failed: 'Saved as published, but the site rebuild could not be started. The dashboard shows the details.',
    not_configured: 'Published. Automatic rebuilds are not set up in this environment yet.',
  }[status];
}

export async function latestPublishJob(db: D1Database): Promise<PublishJob | null> {
  const row = await db
    .prepare('SELECT p.requested_at, p.hook_status, p.detail, u.email FROM publish_jobs p LEFT JOIN users u ON u.id = p.requested_by ORDER BY p.id DESC LIMIT 1')
    .first<{ requested_at: string; hook_status: PublishJob['hookStatus']; detail: string | null; email: string | null }>();
  return row ? { requestedAt: row.requested_at, hookStatus: row.hook_status, detail: row.detail, requestedBy: row.email } : null;
}
