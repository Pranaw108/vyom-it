-- Admin Phase 2: version history and trash for content. Additive only (D1 cannot rebuild FK-referenced tables).

-- A trashed item is hidden from editors and the public site, and purged 30 days after deleted_at.
ALTER TABLE content_entries ADD COLUMN deleted_at TEXT;
ALTER TABLE content_entries ADD COLUMN deleted_by INTEGER REFERENCES users (id);
CREATE INDEX idx_content_deleted ON content_entries (deleted_at);

-- A snapshot of the draft after every save, publish and restore. The newest 30 per item are kept.
CREATE TABLE content_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES content_entries (id),
  event TEXT NOT NULL CHECK (event IN ('save', 'publish', 'restore', 'baseline')),
  data TEXT NOT NULL,
  created_by INTEGER REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_content_versions_entry ON content_versions (entry_id, id);

-- Existing items start with one version: what they hold today.
INSERT INTO content_versions (entry_id, event, data, created_by, created_at)
  SELECT id, 'baseline', draft_data, updated_by, updated_at FROM content_entries;
