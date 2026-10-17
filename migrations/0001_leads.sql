-- Leads from the contact and quote forms (MOD-G).
CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL UNIQUE,
  form_type TEXT NOT NULL CHECK (form_type IN ('contact', 'quote')),
  intent TEXT NOT NULL DEFAULT 'general' CHECK (intent IN ('general', 'audit')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  country TEXT,
  message TEXT NOT NULL,
  services TEXT NOT NULL DEFAULT '[]',
  project_type TEXT,
  platforms TEXT,
  link TEXT,
  timeline TEXT,
  budget TEXT,
  preferred_contact TEXT NOT NULL DEFAULT 'email',
  consent_contact INTEGER NOT NULL CHECK (consent_contact = 1),
  consent_marketing INTEGER NOT NULL DEFAULT 0,
  consent_version TEXT NOT NULL,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_page TEXT,
  ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost', 'spam')),
  notify_status TEXT NOT NULL DEFAULT 'pending' CHECK (notify_status IN ('pending', 'sending', 'sent', 'failed', 'gave_up')),
  notify_attempts INTEGER NOT NULL DEFAULT 0,
  notify_claimed_at TEXT,
  ack_status TEXT NOT NULL DEFAULT 'pending' CHECK (ack_status IN ('pending', 'sending', 'sent', 'failed', 'gave_up', 'skipped')),
  ack_attempts INTEGER NOT NULL DEFAULT 0,
  ack_claimed_at TEXT,
  erased_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_leads_created ON leads (created_at);
CREATE INDEX idx_leads_status ON leads (status);
CREATE INDEX idx_leads_notify ON leads (notify_status);

-- Append-only history per lead. The app has no update or delete path for this table.
CREATE TABLE lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads (id),
  event TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_lead_events_lead ON lead_events (lead_id);

-- Submission attempts per hashed IP, for the 5-per-10-minutes limit. Pruned daily.
CREATE TABLE lead_attempts (
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_lead_attempts ON lead_attempts (ip_hash, created_at);
