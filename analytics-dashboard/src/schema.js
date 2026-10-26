// Additive bootstrap for the existing manually-created D1 database.
// D1 batch is transactional; existing sessions and secrets are preserved.
export const EXTENDED_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS analytics_visitors (
    visitor_id TEXT PRIMARY KEY, first_session_id TEXT NOT NULL,
    first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS analytics_session_details (
    session_id TEXT PRIMARY KEY, visitor_id TEXT, visitor_type TEXT NOT NULL,
    browser TEXT, os TEXT, device TEXT, source TEXT,
    city TEXT, region TEXT, region_code TEXT, country TEXT,
    last_sequence INTEGER NOT NULL DEFAULT -1
  )`,
  `CREATE TABLE IF NOT EXISTS analytics_views (
    view_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, kind TEXT NOT NULL,
    path TEXT NOT NULL, title TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT,
    active_seconds INTEGER NOT NULL DEFAULT 0, max_scroll INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_views_session ON analytics_views(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_views_started ON analytics_views(started_at)`,
  `CREATE TABLE IF NOT EXISTS analytics_events (
    event_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, view_id TEXT,
    type TEXT NOT NULL, label TEXT, target TEXT, path TEXT NOT NULL,
    occurred_at TEXT NOT NULL, percentage INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(type, occurred_at)`,
];
const readyDatabases = new WeakSet();
export async function ensureExtendedSchema(db) {
  if (readyDatabases.has(db)) return;
  try { await db.prepare('SELECT visitor_id FROM analytics_visitors LIMIT 0').all(); }
  catch (error) {
    if (!String(error.message).includes('no such table')) throw error;
    await db.batch(EXTENDED_SCHEMA.map((sql) => db.prepare(sql)));
  }
  readyDatabases.add(db);
}
