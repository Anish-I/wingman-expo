import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

export type DB = Database.Database;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  tier          TEXT NOT NULL DEFAULT 'Pro',
  created_at    TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS connect_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_slug   TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_connections (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_slug     TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  connection_id TEXT,
  PRIMARY KEY (user_id, app_slug)
);

CREATE TABLE IF NOT EXISTS flows (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger     TEXT NOT NULL,
  runs        INTEGER NOT NULL DEFAULT 0,
  color       TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 0,
  app_slug    TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS flows_user_idx ON flows (user_id);

CREATE TABLE IF NOT EXISTS activities (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  subtitle   TEXT NOT NULL,
  pip        TEXT NOT NULL,
  color      TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activities_user_idx ON activities (user_id, created_at);

CREATE TABLE IF NOT EXISTS calendar_events (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  start_iso TEXT NOT NULL,
  end_iso   TEXT NOT NULL,
  subtitle  TEXT NOT NULL,
  emoji     TEXT NOT NULL,
  color     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS calendar_events_user_idx ON calendar_events (user_id, start_iso);

CREATE TABLE IF NOT EXISTS chat_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,
  content      TEXT NOT NULL DEFAULT '',
  tool_calls   TEXT,
  tool_call_id TEXT,
  name         TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON chat_messages (user_id, id);

CREATE TABLE IF NOT EXISTS memory_docs (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, slug)
);
`;

export function openDb(filePath: string): DB {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}
