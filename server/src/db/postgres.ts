import pg from 'pg';

export type PgPool = pg.Pool;

/**
 * Postgres schema for Wingman (Supabase-compatible).
 *
 * Ported from db/sqlite.ts. Differences from the SQLite schema:
 *  - INTEGER PRIMARY KEY AUTOINCREMENT  -> BIGINT GENERATED ALWAYS AS IDENTITY
 *  - INTEGER 0/1 booleans (flows.active) -> BOOLEAN
 *  - lower(email) unique index          -> functional unique index (same syntax)
 *  - timestamps stay TEXT (ISO-8601) to match nowIso() + lexical ordering;
 *    revisit to TIMESTAMPTZ once the store is fully on Postgres.
 *
 * Schema is applied idempotently on boot (CREATE TABLE IF NOT EXISTS), mirroring
 * the SQLite "schema-on-boot" approach. For Supabase we run this once via the
 * connection string; later we can move it to versioned SQL migrations.
 */
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
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_slug      TEXT NOT NULL,
  connected_at  TEXT NOT NULL,
  connection_id TEXT,
  PRIMARY KEY (user_id, app_slug)
);

CREATE TABLE IF NOT EXISTS flows (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji        TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  trigger      TEXT NOT NULL,
  runs         INTEGER NOT NULL DEFAULT 0,
  color        TEXT NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT FALSE,
  app_slug     TEXT NOT NULL,
  -- Flows v1: executable definition (schedule + steps) stored as JSON.
  -- Nullable so legacy/display-only rows keep working; runner skips null defs.
  definition   JSONB,
  last_run_at  TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS flows_user_idx ON flows (user_id);
CREATE INDEX IF NOT EXISTS flows_active_idx ON flows (active);

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
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

let pool: PgPool | null = null;

/**
 * Open (or reuse) the Postgres pool and ensure the schema exists.
 *
 * Supabase: use the connection string from Project Settings → Database.
 * For a long-running server prefer the session pooler / direct connection.
 *
 * TLS: we verify the server certificate by default (Supabase's pooler chains to
 * a public CA, so system roots validate it). Do NOT disable verification — that
 * exposes the connection to MITM. If you hit a self-signed cert in a private
 * setup, point `DATABASE_CA_CERT` at the CA PEM so it can be verified properly.
 * Local Postgres (localhost) runs without SSL.
 */
function sslConfig(connectionString: string): pg.PoolConfig['ssl'] {
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  if (isLocal) return undefined;
  const ca = process.env.DATABASE_CA_CERT?.trim();
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true };
}

// Fixed key for the schema-setup advisory lock (arbitrary, stable across boots).
const SCHEMA_LOCK_KEY = 0x77_69_6e_67; // "wing"

export async function openPg(connectionString: string): Promise<PgPool> {
  if (pool) return pool;
  pool = new pg.Pool({
    connectionString,
    ssl: sslConfig(connectionString),
    max: 10,
  });
  // Serialize schema application with a session advisory lock. Postgres'
  // CREATE TABLE/INDEX IF NOT EXISTS is not safe under concurrent DDL (it can
  // race on the pg_type/pg_class catalogs), which bites when multiple instances
  // or test processes boot at once. The lock makes setup single-flight.
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [SCHEMA_LOCK_KEY]);
    await client.query(SCHEMA_SQL);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [SCHEMA_LOCK_KEY]).catch(() => {});
    client.release();
  }
  return pool;
}

export async function closePg(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
