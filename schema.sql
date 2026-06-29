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
