-- D1 schema for diet-planner.
-- One row per user. The whole Pinia state lives in the JSON blob.

CREATE TABLE IF NOT EXISTS user_data (
  email      TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
