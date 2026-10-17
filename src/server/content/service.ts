import { getCollection, type CollectionDef } from '../../lib/content/collections';
import { normalise } from '../../lib/content/fields';
import { AuditLog } from '../admin/audit';
import type { AdminContext } from '../admin/context';
import { COLLECTION_SCHEMAS } from './registry';
import { ContentStore, type ContentEntry } from './store';
import { requestRebuild } from './publish';

export type ContentAction = 'save' | 'submit' | 'publish' | 'unpublish' | 'move-up' | 'move-down';

export type ContentResult =
  | { ok: true; entry: ContentEntry; issues: string[]; rebuild?: string }
  | { ok: false; status: number; error: string; issues?: string[] };

export interface ContentDeps {
  db: D1Database;
  deployHookUrl: string;
}

const KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Human-readable validation problems, e.g. "faqs › 2 › answer: Too short". */
export function validationIssues(def: CollectionDef, data: unknown): string[] {
  const result = COLLECTION_SCHEMAS[def.name].safeParse(data);
  if (result.success) return [];
  return result.error.issues.map((i) => `${i.path.map((p) => (typeof p === 'number' ? p + 1 : p)).join(' › ') || 'entry'}: ${i.message}`);
}

function denied(error: string): ContentResult {
  return { ok: false, status: 403, error };
}

/** Applies one editor action. Every change and its audit entry are written in one batch. */
export async function applyContentAction(
  admin: AdminContext,
  deps: ContentDeps,
  input: { action: ContentAction; collection: string; key: string | null; data?: unknown; rowVersion?: number },
): Promise<ContentResult> {
  const def = getCollection(input.collection);
  if (!def) return { ok: false, status: 404, error: 'Unknown content type.' };
  if (!admin.can('content.view')) return denied('You do not have access to content.');

  const store = new ContentStore(deps.db);
  const audit = new AuditLog(deps.db);
  const userId = admin.user.id;
  const existing = input.key && input.key !== 'new' ? await store.get(def.name, input.key) : null;
  if (input.key && input.key !== 'new' && !existing) return { ok: false, status: 404, error: 'This item no longer exists.' };

  const conflict = (): ContentResult => ({
    ok: false,
    status: 409,
    error: 'Someone else changed this item after you opened it. Reload to see their changes, then make your edit again.',
  });

  switch (input.action) {
    case 'save': {
      if (!admin.can('content.edit') || !admin.can(def.editPermission)) return denied('Your role cannot edit this content.');
      const data = normalise(def.fields, input.data);
      const key = def.kind === 'single' ? 'main' : (def.keyOf?.(data) ?? '');
      if (!KEY_RE.test(key)) return { ok: false, status: 422, error: 'Add a web address / id using lowercase letters, numbers and hyphens.' };
      const clash = key !== existing?.key ? await store.get(def.name, key) : null;
      if (clash) return { ok: false, status: 409, error: `Another item already uses "${key}". Choose a different one.` };

      if (!existing) {
        await store.batch([store.insertStatement(def.name, key, data, userId), audit.statement(admin.actor, 'content.create', def.name, key, def.titleOf(data))]);
      } else {
        const [result] = await store.batch([
          store.updateDraftStatement(existing.id, key, data, input.rowVersion ?? -1, userId),
          audit.statement(admin.actor, 'content.save', def.name, key, changeSummary(existing, key)),
        ]);
        if (!result?.meta.changes) return conflict();
      }
      const saved = (await store.get(def.name, key))!;
      return { ok: true, entry: saved, issues: validationIssues(def, data) };
    }

    case 'submit': {
      if (!existing) return { ok: false, status: 404, error: 'Save the item first.' };
      if (!admin.can('content.submit')) return denied('Your role cannot submit for review.');
      const [result] = await store.batch([
        store.setReviewStatement(existing.id, 'in_review', input.rowVersion ?? -1, userId),
        audit.statement(admin.actor, 'content.submit', def.name, existing.key, def.titleOf(existing.draft)),
      ]);
      if (!result?.meta.changes) return conflict();
      return { ok: true, entry: (await store.get(def.name, existing.key))!, issues: validationIssues(def, existing.draft) };
    }

    case 'publish': {
      if (!existing) return { ok: false, status: 404, error: 'Save the item first.' };
      if (!admin.can('content.publish') || !admin.can(def.editPermission)) return denied('Your role cannot publish. Submit it for review instead.');
      const issues = validationIssues(def, existing.draft);
      if (issues.length) return { ok: false, status: 422, error: 'Fix these before publishing:', issues };
      const [result] = await store.batch([
        store.publishStatement(existing.id, input.rowVersion ?? -1, userId),
        audit.statement(admin.actor, 'content.publish', def.name, existing.key, def.titleOf(existing.draft)),
      ]);
      if (!result?.meta.changes) return conflict();
      const rebuild = await requestRebuild(deps, admin);
      return { ok: true, entry: (await store.get(def.name, existing.key))!, issues: [], rebuild };
    }

    case 'unpublish': {
      if (!existing) return { ok: false, status: 404, error: 'Item not found.' };
      if (def.kind === 'single') return { ok: false, status: 422, error: 'This page is required by the website and cannot be taken offline.' };
      if (!admin.can('content.publish') || !admin.can(def.editPermission)) return denied('Your role cannot take content offline.');
      const [result] = await store.batch([
        store.unpublishStatement(existing.id, input.rowVersion ?? -1, userId),
        audit.statement(admin.actor, 'content.unpublish', def.name, existing.key, def.titleOf(existing.draft)),
      ]);
      if (!result?.meta.changes) return conflict();
      const rebuild = await requestRebuild(deps, admin);
      return { ok: true, entry: (await store.get(def.name, existing.key))!, issues: [], rebuild };
    }

    case 'move-up':
    case 'move-down': {
      if (!existing || def.kind !== 'list') return { ok: false, status: 404, error: 'Item not found.' };
      if (!admin.can('content.publish') || !admin.can(def.editPermission)) return denied('Your role cannot change the order.');
      const siblings = await store.list(def.name);
      const index = siblings.findIndex((s) => s.id === existing.id);
      const swapWith = siblings[input.action === 'move-up' ? index - 1 : index + 1];
      if (!swapWith) return { ok: true, entry: existing, issues: [] };
      // Re-number all items so positions stay unique even if older data had gaps or ties.
      const ordered = [...siblings];
      [ordered[index], ordered[ordered.indexOf(swapWith)]] = [swapWith, existing];
      await store.batch([
        ...ordered.map((s, i) => store.positionStatement(s.id, i)),
        audit.statement(admin.actor, 'content.reorder', def.name, existing.key, `${input.action === 'move-up' ? 'Moved up' : 'Moved down'}`),
      ]);
      const rebuild = await requestRebuild(deps, admin);
      return { ok: true, entry: (await store.get(def.name, existing.key))!, issues: [], rebuild };
    }
  }
}

function changeSummary(existing: ContentEntry, newKey: string): string {
  return existing.key === newKey ? 'Draft saved' : `Draft saved; address changed from "${existing.key}" to "${newKey}"`;
}
