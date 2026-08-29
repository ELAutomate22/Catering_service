-- ============================================================================
-- Request-a-Quote: enquiries, admin accounts, and the supporting tables.
--
-- Multi-select answers are stored as JSON arrays in TEXT columns. SQLite has
-- no array type, and a join table per multi-select (catering services, meal
-- parts, dietary needs, extra services, event style) would mean five extra
-- tables that are only ever read back whole, with the enquiry. Things that are
-- genuinely their own records — notes, activity, files — do get their own
-- tables, because they are written independently and queried on their own.
-- ============================================================================

CREATE TABLE IF NOT EXISTS enquiries (
  id                    TEXT PRIMARY KEY,
  reference             TEXT NOT NULL UNIQUE,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,

  -- customer
  full_name             TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 120),
  email                 TEXT NOT NULL CHECK (length(email) BETWEEN 5 AND 160),
  phone                 TEXT NOT NULL CHECK (length(trim(phone)) BETWEEN 6 AND 32),
  preferred_contact     TEXT,
  address_line          TEXT,
  city                  TEXT,
  region                TEXT,
  postcode              TEXT,
  country               TEXT,

  -- event
  event_type            TEXT NOT NULL,
  event_type_other      TEXT,
  event_date            TEXT NOT NULL,
  start_time            TEXT,
  end_time              TEXT,
  guest_count           INTEGER NOT NULL CHECK (guest_count >= 1 AND guest_count <= 100000),
  child_guest_count     INTEGER CHECK (child_guest_count IS NULL OR (child_guest_count >= 0 AND child_guest_count <= 100000)),
  venue_status          TEXT,
  venue_name            TEXT,
  venue_address         TEXT,
  venue_city            TEXT,
  venue_region          TEXT,
  venue_postcode        TEXT,
  venue_country         TEXT,

  -- catering  (JSON arrays)
  catering_services     TEXT NOT NULL DEFAULT '[]',
  catering_services_other TEXT,
  meal_requirements     TEXT NOT NULL DEFAULT '[]',
  meal_requirements_other TEXT,
  food_style            TEXT,
  food_style_other      TEXT,
  existing_menu         TEXT,
  menu_description      TEXT,

  -- dietary
  dietary_requirements  TEXT NOT NULL DEFAULT '[]',
  dietary_details       TEXT,
  affected_guest_count  INTEGER CHECK (affected_guest_count IS NULL OR affected_guest_count >= 0),

  -- extra services + styling
  additional_services   TEXT NOT NULL DEFAULT '[]',
  additional_services_other TEXT,
  event_style           TEXT NOT NULL DEFAULT '[]',
  theme_colours         TEXT,

  -- commercial + provenance
  approximate_budget    TEXT,
  referral_source       TEXT,
  additional_information TEXT,

  -- admin-owned fields
  status                TEXT NOT NULL DEFAULT 'new',
  priority              TEXT NOT NULL DEFAULT 'normal',
  assigned_to           TEXT,
  quoted_amount         REAL,
  quote_currency        TEXT DEFAULT 'EUR',
  deposit_amount        REAL,
  deposit_percent       REAL,
  quote_notes           TEXT,
  quote_expiry          TEXT,
  archived              INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),

  -- GDPR: consent is recorded with the moment it was given
  privacy_consent       INTEGER NOT NULL CHECK (privacy_consent = 1),
  privacy_consent_at    TEXT NOT NULL,

  -- provenance. submitter_hash is a salted digest used only for flood control;
  -- no raw IP address is ever stored.
  source                TEXT,
  submitter_hash        TEXT
);

CREATE INDEX IF NOT EXISTS idx_enq_list     ON enquiries (archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enq_status   ON enquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enq_event    ON enquiries (event_date);
CREATE INDEX IF NOT EXISTS idx_enq_ref      ON enquiries (reference);
CREATE INDEX IF NOT EXISTS idx_enq_flood    ON enquiries (submitter_hash, created_at);

-- Human-readable references (YRC-2026-000142) come from a counter row updated
-- atomically, never from COUNT(*), which would collide under concurrency.
CREATE TABLE IF NOT EXISTS reference_counter (
  year      INTEGER PRIMARY KEY,
  last_seq  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS enquiry_notes (
  id          TEXT PRIMARY KEY,
  enquiry_id  TEXT NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  author      TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_enq ON enquiry_notes (enquiry_id, created_at DESC);

CREATE TABLE IF NOT EXISTS enquiry_activity (
  id          TEXT PRIMARY KEY,
  enquiry_id  TEXT NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  detail      TEXT,
  actor       TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_enq ON enquiry_activity (enquiry_id, created_at DESC);

-- Files live in R2; only the pointer and metadata live here.
CREATE TABLE IF NOT EXISTS enquiry_files (
  id           TEXT PRIMARY KEY,
  enquiry_id   TEXT NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  r2_key       TEXT NOT NULL,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_enq ON enquiry_files (enquiry_id);

-- Admin accounts. Only a PBKDF2 hash and its salt are stored; passwords are
-- set locally by the owner (scripts/set-admin-password.mjs) and never travel
-- through this repository.
CREATE TABLE IF NOT EXISTS admin_users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  password_salt  TEXT NOT NULL,
  iterations     INTEGER NOT NULL,
  created_at     TEXT NOT NULL,
  last_login_at  TEXT
);

-- Sessions store only a hash of the cookie token, so a database leak does not
-- hand over live sessions.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON admin_sessions (expires_at);
