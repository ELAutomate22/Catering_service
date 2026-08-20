-- ============================================================================
-- Reviews store for Yeshua Royal Catering Services (Cloudflare D1)
-- Mirrors the constraints the old Postgres table enforced, so bad rows are
-- rejected by the database even if the Worker's validation is ever bypassed.
-- ============================================================================

CREATE TABLE IF NOT EXISTS catering_reviews (
  id         TEXT    PRIMARY KEY,
  created_at TEXT    NOT NULL,
  name       TEXT    NOT NULL CHECK (length(trim(name))  BETWEEN 2  AND 60),
  role       TEXT             CHECK (role IS NULL OR length(role) <= 60),
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  quote      TEXT    NOT NULL CHECK (length(trim(quote)) BETWEEN 10 AND 600),
  -- 1 = visible on the site. Set to 0 to hide a review without deleting it.
  approved   INTEGER NOT NULL DEFAULT 1 CHECK (approved IN (0, 1)),
  -- Salted SHA-256 of the poster's IP. Used only for flood control; the raw
  -- address is never stored, so this cannot be reversed back to a visitor.
  ip_hash    TEXT
);

-- Serves the public read: approved rows, newest first.
CREATE INDEX IF NOT EXISTS idx_reviews_public
  ON catering_reviews (approved, created_at DESC);

-- Serves the flood-control lookup.
CREATE INDEX IF NOT EXISTS idx_reviews_ip
  ON catering_reviews (ip_hash, created_at);
