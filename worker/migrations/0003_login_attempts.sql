-- ============================================================================
-- Failed-login throttling.
--
-- Sign-in is password-only now, so there is no username to guess alongside it
-- and every guess is a whole attempt at the secret. Without a lock an attacker
-- can grind the password at whatever rate the network allows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash      TEXT PRIMARY KEY,
  fails        INTEGER NOT NULL DEFAULT 0,
  last_fail_at TEXT,
  locked_until TEXT
);
