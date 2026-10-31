import type { CollectionName } from '../../lib/content/collections';

export interface ContentEntry {
  id: number;
  collection: CollectionName;
  key: string;
  position: number;
  draft: Record<string, unknown>;
  published: Record<string, unknown> | null;
  reviewStatus: 'draft' | 'in_review' | 'clean';
  rowVersion: number;
  updatedBy: string | null;
  updatedAt: string;
  publishedAt: string | null;
  deletedAt: string | null;
}

export interface ContentVersion {
  id: number;
  event: 'save' | 'publish' | 'restore' | 'baseline';
  data: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
}

export const VERSIONS_KEPT = 30;
export const TRASH_DAYS = 30;

const toEntry = (r: Record<string, unknown>): ContentEntry => ({
  id: r.id as number,
  collection: r.collection as CollectionName,
  key: r.key as string,
  position: r.position as number,
  draft: JSON.parse(r.draft_data as string),
  published: r.published_data ? JSON.parse(r.published_data as string) : null,
  reviewStatus: r.review_status as ContentEntry['reviewStatus'],
  rowVersion: r.row_version as number,
  updatedBy: (r.updated_by_email as string | null) ?? null,
  updatedAt: r.updated_at as string,
  publishedAt: (r.published_at as string | null) ?? null,
  deletedAt: (r.deleted_at as string | null) ?? null,
});

const SELECT = `SELECT c.*, u.username AS updated_by_email FROM content_entries c LEFT JOIN users u ON u.id = c.updated_by`;
const LIVE = 'c.deleted_at IS NULL';

export class ContentStore {
  constructor(private readonly db: D1Database) {}

  async list(collection: CollectionName): Promise<ContentEntry[]> {
    const { results } = await this.db.prepare(`${SELECT} WHERE c.collection = ? AND ${LIVE} ORDER BY c.position, c.id`).bind(collection).all<Record<string, unknown>>();
    return results.map(toEntry);
  }

  async get(collection: CollectionName, key: string): Promise<ContentEntry | null> {
    const row = await this.db.prepare(`${SELECT} WHERE c.collection = ? AND c.key = ? AND ${LIVE}`).bind(collection, key).first<Record<string, unknown>>();
    return row ? toEntry(row) : null;
  }

  /** Any item with this key, including one in the trash (keys stay unique across both). */
  async getIncludingTrash(collection: CollectionName, key: string): Promise<ContentEntry | null> {
    const row = await this.db.prepare(`${SELECT} WHERE c.collection = ? AND c.key = ?`).bind(collection, key).first<Record<string, unknown>>();
    return row ? toEntry(row) : null;
  }

  async listTrash(): Promise<ContentEntry[]> {
    const { results } = await this.db.prepare(`${SELECT} WHERE c.deleted_at IS NOT NULL ORDER BY c.deleted_at DESC`).all<Record<string, unknown>>();
    return results.map(toEntry);
  }

  async versions(entryId: number): Promise<ContentVersion[]> {
    const { results } = await this.db
      .prepare(
        `SELECT v.id, v.event, v.data, v.created_at, u.username AS created_by FROM content_versions v
         LEFT JOIN users u ON u.id = v.created_by WHERE v.entry_id = ? ORDER BY v.id DESC LIMIT ?`,
      )
      .bind(entryId, VERSIONS_KEPT)
      .all<Record<string, unknown>>();
    return results.map((r) => ({
      id: r.id as number,
      event: r.event as ContentVersion['event'],
      data: JSON.parse(r.data as string),
      createdBy: (r.created_by as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  }

  async version(entryId: number, versionId: number): Promise<ContentVersion | null> {
    return (await this.versions(entryId)).find((v) => v.id === versionId) ?? null;
  }

  async counts(): Promise<{ inReview: number; changed: number }> {
    const row = await this.db
      .prepare(
        `SELECT SUM(review_status = 'in_review') AS in_review,
                SUM(review_status != 'clean' OR published_data IS NULL) AS changed
         FROM content_entries WHERE deleted_at IS NULL`,
      )
      .first<{ in_review: number | null; changed: number | null }>();
    return { inReview: row?.in_review ?? 0, changed: row?.changed ?? 0 };
  }

  insertStatement(collection: CollectionName, key: string, data: unknown, userId: number) {
    return this.db
      .prepare(
        `INSERT INTO content_entries (collection, key, position, draft_data, review_status, updated_by, updated_at)
         VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM content_entries WHERE collection = ?), ?, 'draft', ?, ?)`,
      )
      .bind(collection, key, collection, JSON.stringify(data), userId, new Date().toISOString());
  }

  /** Saves a draft only if nobody else saved since it was opened (optimistic lock). */
  updateDraftStatement(id: number, key: string, data: unknown, rowVersion: number, userId: number) {
    return this.db
      .prepare(
        `UPDATE content_entries SET key = ?, draft_data = ?, review_status = 'draft', row_version = row_version + 1,
           updated_by = ?, updated_at = ?
         WHERE id = ? AND row_version = ?`,
      )
      .bind(key, JSON.stringify(data), userId, new Date().toISOString(), id, rowVersion);
  }

  setReviewStatement(id: number, status: ContentEntry['reviewStatus'], rowVersion: number, userId: number) {
    return this.db
      .prepare(`UPDATE content_entries SET review_status = ?, row_version = row_version + 1, updated_by = ?, updated_at = ? WHERE id = ? AND row_version = ?`)
      .bind(status, userId, new Date().toISOString(), id, rowVersion);
  }

  publishStatement(id: number, rowVersion: number, userId: number) {
    const now = new Date().toISOString();
    return this.db
      .prepare(
        `UPDATE content_entries SET published_data = draft_data, review_status = 'clean', published_at = ?,
           row_version = row_version + 1, updated_by = ?, updated_at = ?
         WHERE id = ? AND row_version = ?`,
      )
      .bind(now, userId, now, id, rowVersion);
  }

  unpublishStatement(id: number, rowVersion: number, userId: number) {
    return this.db
      .prepare(
        `UPDATE content_entries SET published_data = NULL, published_at = NULL, row_version = row_version + 1,
           updated_by = ?, updated_at = ?
         WHERE id = ? AND row_version = ?`,
      )
      .bind(userId, new Date().toISOString(), id, rowVersion);
  }

  /**
   * Snapshots the item's current draft. Batch it right after the audit statement: it writes only if
   * that one did, so a refused (conflicting) change leaves no version behind.
   */
  versionStatement(id: number, event: ContentVersion['event'], userId: number) {
    return this.db
      .prepare(`INSERT INTO content_versions (entry_id, event, data, created_by, created_at) SELECT id, ?, draft_data, ?, ? FROM content_entries WHERE id = ? AND changes() > 0`)
      .bind(event, userId, new Date().toISOString(), id);
  }

  /** Snapshot for a new item, found by its key. Same chaining rule as versionStatement. */
  versionByKeyStatement(collection: CollectionName, key: string, userId: number) {
    return this.db
      .prepare(`INSERT INTO content_versions (entry_id, event, data, created_by, created_at) SELECT id, 'save', draft_data, ?, ? FROM content_entries WHERE collection = ? AND key = ? AND changes() > 0`)
      .bind(userId, new Date().toISOString(), collection, key);
  }

  /** Puts a version's data back into the draft (never straight onto the live site). */
  restoreDraftStatement(id: number, data: unknown, rowVersion: number, userId: number, matchesLive: boolean) {
    return this.db
      .prepare(`UPDATE content_entries SET draft_data = ?, review_status = ${matchesLive ? "'clean'" : "'draft'"}, row_version = row_version + 1, updated_by = ?, updated_at = ? WHERE id = ? AND row_version = ? AND deleted_at IS NULL`)
      .bind(JSON.stringify(data), userId, new Date().toISOString(), id, rowVersion);
  }

  trashStatement(id: number, userId: number) {
    return this.db
      .prepare(`UPDATE content_entries SET deleted_at = ?, deleted_by = ?, row_version = row_version + 1 WHERE id = ? AND deleted_at IS NULL`)
      .bind(new Date().toISOString(), userId, id);
  }

  untrashStatement(id: number) {
    return this.db
      .prepare(`UPDATE content_entries SET deleted_at = NULL, deleted_by = NULL, row_version = row_version + 1,
                  position = (SELECT COALESCE(MAX(e.position), -1) + 1 FROM content_entries e WHERE e.collection = content_entries.collection AND e.deleted_at IS NULL)
                WHERE id = ? AND deleted_at IS NOT NULL`)
      .bind(id);
  }

  /** Daily: removes items that have been in the trash longer than TRASH_DAYS, and old versions. */
  async purge(now = new Date()): Promise<{ items: number; versions: number }> {
    const cutoff = new Date(now.getTime() - TRASH_DAYS * 86_400_000).toISOString();
    const expired = `SELECT id FROM content_entries WHERE deleted_at IS NOT NULL AND deleted_at < ?`;
    const [trashedVersions, items, oldVersions] = await this.db.batch([
      this.db.prepare(`DELETE FROM content_versions WHERE entry_id IN (${expired})`).bind(cutoff),
      this.db.prepare(`DELETE FROM content_entries WHERE id IN (${expired})`).bind(cutoff),
      this.db
        .prepare(`DELETE FROM content_versions WHERE id NOT IN (SELECT id FROM content_versions v WHERE v.entry_id = content_versions.entry_id ORDER BY v.id DESC LIMIT ?)`)
        .bind(VERSIONS_KEPT),
    ]);
    return { items: items?.meta.changes ?? 0, versions: (trashedVersions?.meta.changes ?? 0) + (oldVersions?.meta.changes ?? 0) };
  }

  positionStatement(id: number, position: number) {
    return this.db.prepare('UPDATE content_entries SET position = ?, row_version = row_version + 1 WHERE id = ?').bind(position, id);
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    return this.db.batch(statements);
  }
}
