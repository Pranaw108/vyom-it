-- Admin panel (MOD-I, Phase 1): users, editable content, audit log, publish tracking, lead notes.

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'content_manager', 'contributor', 'sales', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  invited_by INTEGER REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT
);

-- One row per content item. Edits go to draft_data; publishing copies it to published_data,
-- which is the only thing the public site build reads.
CREATE TABLE content_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection TEXT NOT NULL,
  key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  draft_data TEXT NOT NULL,
  published_data TEXT,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'in_review', 'clean')),
  row_version INTEGER NOT NULL DEFAULT 1,
  updated_by INTEGER REFERENCES users (id),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at TEXT,
  UNIQUE (collection, key)
);
CREATE INDEX idx_content_collection ON content_entries (collection, position);

-- Append-only. The application has no update or delete statement for this table (FR-150).
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users (id),
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_audit_created ON audit_log (created_at);

CREATE TABLE publish_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requested_by INTEGER REFERENCES users (id),
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  hook_status TEXT NOT NULL CHECK (hook_status IN ('sent', 'batched', 'failed', 'not_configured')),
  detail TEXT
);

CREATE TABLE lead_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads (id),
  author_id INTEGER REFERENCES users (id),
  author_email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_lead_notes_lead ON lead_notes (lead_id);

CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  alt TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
