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
}

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
});

const SELECT = `SELECT c.*, u.email AS updated_by_email FROM content_entries c LEFT JOIN users u ON u.id = c.updated_by`;

export class ContentStore {
  constructor(private readonly db: D1Database) {}

  async list(collection: CollectionName): Promise<ContentEntry[]> {
    const { results } = await this.db.prepare(`${SELECT} WHERE c.collection = ? ORDER BY c.position, c.id`).bind(collection).all<Record<string, unknown>>();
    return results.map(toEntry);
  }

  async get(collection: CollectionName, key: string): Promise<ContentEntry | null> {
    const row = await this.db.prepare(`${SELECT} WHERE c.collection = ? AND c.key = ?`).bind(collection, key).first<Record<string, unknown>>();
    return row ? toEntry(row) : null;
  }

  async counts(): Promise<{ inReview: number; changed: number }> {
    const row = await this.db
      .prepare(
        `SELECT SUM(review_status = 'in_review') AS in_review,
                SUM(review_status != 'clean' OR published_data IS NULL) AS changed
         FROM content_entries`,
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

  positionStatement(id: number, position: number) {
    return this.db.prepare('UPDATE content_entries SET position = ?, row_version = row_version + 1 WHERE id = ?').bind(position, id);
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    return this.db.batch(statements);
  }
}
