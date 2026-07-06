-- D1 schema for diet-planner.
-- One row per user. The whole Pinia state lives in the JSON blob.

CREATE TABLE IF NOT EXISTS user_data (
  email      TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Rolling per-user snapshots taken before overwrites (see functions/api/data.js).
-- A safety net against accidental data loss; pruned to the latest 20 per user.
CREATE TABLE IF NOT EXISTS user_data_backups (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL,
  data         TEXT NOT NULL,
  updated_at   INTEGER NOT NULL,  -- updated_at of the snapshotted version
  backed_up_at INTEGER NOT NULL,  -- when this snapshot was taken
  reason       TEXT               -- 'shrink' | 'periodic'
);

CREATE INDEX IF NOT EXISTS idx_user_data_backups_email
  ON user_data_backups (email, backed_up_at DESC);

-- Public read-only share links for a week plan (see functions/api/share.js).
-- Created by an authenticated user; readable without auth until expiry.
CREATE TABLE IF NOT EXISTS shared_plans (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  email      TEXT NOT NULL,    -- creator's email
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL  -- created_at + 30 days
);

-- Aggregate, numeric-only health signal for meal-plan generation. No personal
-- data and no plan content — just per-generation recalculation metrics
-- (see functions/api/generate-meal-plan.js). Written best-effort.
CREATE TABLE IF NOT EXISTS generation_metrics (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at           INTEGER NOT NULL,
  model                TEXT,
  provider             TEXT,
  outcome              TEXT,     -- 'ok' | 'recalc_failed' | 'parse_failed'
  dishes_total         INTEGER,
  dishes_fully_matched INTEGER,
  avg_drift_kcal       INTEGER,
  scalings_count       INTEGER,
  forbidden_hits       INTEGER
);

-- Per-user rate limiting for the paid generation endpoint. One row per
-- (user, time-window bucket); counters are bumped atomically. See
-- checkAndIncrement() in functions/api/generate-meal-plan.js. Old buckets are
-- pruned best-effort.
-- NOTE: the `email` column is used as a generic "subject": for generation it's
-- the user email (buckets 'h:'/'d:'); for auth it's 'ip:<ip>' / 'email:<addr>'
-- (buckets 'login:'/'register:'). See TODO: generalize the column name to
-- `subject` in a later migration.
CREATE TABLE IF NOT EXISTS rate_limits (
  email        TEXT NOT NULL,
  bucket       TEXT NOT NULL,    -- '<windowId>:<windowStart>' e.g. 'h:1719750000000'
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  PRIMARY KEY (email, bucket)
);

-- ===========================================================================
-- Own authentication (SaaS multi-tenant, tenant = individual user). Piece (a).
-- ===========================================================================

-- User account. One canonical email per account (the account-linking key).
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,               -- crypto.randomUUID()
  email          TEXT NOT NULL UNIQUE,           -- lowercased
  email_verified INTEGER NOT NULL DEFAULT 0,     -- 0/1 (enforcement in step b)
  display_name   TEXT,
  status         TEXT NOT NULL DEFAULT 'active', -- active | suspended
  created_at     INTEGER NOT NULL,               -- ms epoch
  updated_at     INTEGER NOT NULL
);

-- Login methods. Multiple providers per user. In (a) only 'password' is used;
-- 'google'/'apple' are schema-ready for later steps.
CREATE TABLE IF NOT EXISTS identities (
  id               TEXT PRIMARY KEY,             -- crypto.randomUUID()
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,                -- 'password' | 'google' | 'apple'
  provider_subject TEXT NOT NULL,                -- password: user_id; OAuth: `sub`
  email            TEXT,                         -- email as seen by the provider
  email_verified   INTEGER NOT NULL DEFAULT 0,
  password_hash    TEXT,                         -- only provider='password'
  created_at       INTEGER NOT NULL,
  last_login_at    INTEGER,
  UNIQUE (provider, provider_subject),
  UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_identities_user ON identities (user_id);

-- Sessions. Only SHA-256(token) is stored, never the token itself.
CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,                 -- crypto.randomUUID()
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,             -- hex SHA-256 of the opaque token
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,                 -- now + 30d, sliding
  last_seen_at INTEGER,
  user_agent   TEXT,
  revoked      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
