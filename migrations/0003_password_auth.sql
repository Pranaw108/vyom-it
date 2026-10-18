-- Password sign-in, server-side sessions, one-time setup links, login rate limiting,
-- and a "client" role with per-account permissions.
--
-- users is only extended, never rebuilt: D1 cannot drop a table that other tables reference,
-- even with deferred foreign keys. The old `role` column keeps its CHECK constraint, so roles now
-- live in `access_role` (which allows 'client'); `role` is kept in sync with a least-privilege value.

ALTER TABLE users ADD COLUMN username TEXT;
UPDATE users SET username = lower(substr(email, 1, instr(email, '@') - 1));
CREATE UNIQUE INDEX idx_users_username ON users (username COLLATE NOCASE);

ALTER TABLE users ADD COLUMN access_role TEXT NOT NULL DEFAULT 'viewer'
  CHECK (access_role IN ('owner', 'content_manager', 'contributor', 'sales', 'viewer', 'client'));
UPDATE users SET access_role = role;

-- JSON array of permissions an Owner granted; only used for the client role.
ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_changed_at TEXT;

-- Server-side sessions: the cookie holds a random token; only its SHA-256 hash is stored,
-- so a database leak does not expose usable sessions. Logout and revocation take effect at once.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  method TEXT NOT NULL CHECK (method IN ('password', 'google')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  ip_hash TEXT,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

-- One-time links to set a first password or reset one. Only the hash of the token is stored.
CREATE TABLE account_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  purpose TEXT NOT NULL CHECK (purpose IN ('setup', 'reset')),
  created_by INTEGER REFERENCES users (id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX idx_account_tokens_user ON account_tokens (user_id);

-- Sign-in attempts per username and per hashed IP, for lockout and rate limiting. Pruned daily.
CREATE TABLE login_attempts (
  scope TEXT NOT NULL CHECK (scope IN ('user', 'ip')),
  key TEXT NOT NULL,
  success INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_login_attempts ON login_attempts (scope, key, created_at);
