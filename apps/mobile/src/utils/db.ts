import * as SQLite from 'expo-sqlite';

/**
 * Relational local storage: sources (playlists/Xtream connections),
 * channels, favorites, history, EPG programs. This is what lets the app
 * show previously-loaded data instantly and even while offline (product
 * rule #33) — the videos themselves are not cached, only their metadata.
 *
 * Indexed on (sourceId) and (groupTitle) so search/category filtering
 * stays fast on playlists with several thousand channels without loading
 * everything into a JS array up front.
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  payload TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  lastRefreshedAt TEXT,
  channelCount INTEGER,
  lastError TEXT
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY NOT NULL,
  sourceId TEXT NOT NULL,
  name TEXT NOT NULL,
  streamUrl TEXT NOT NULL,
  logoUrl TEXT,
  groupTitle TEXT,
  tvgId TEXT,
  tvgName TEXT,
  country TEXT,
  category TEXT,
  sortIndex INTEGER NOT NULL,
  FOREIGN KEY (sourceId) REFERENCES sources(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_channels_source ON channels(sourceId);
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(sourceId, category);
CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS favorites (
  channelId TEXT PRIMARY KEY NOT NULL,
  sourceId TEXT NOT NULL,
  addedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
  channelId TEXT PRIMARY KEY NOT NULL,
  sourceId TEXT NOT NULL,
  channelName TEXT NOT NULL,
  logoUrl TEXT,
  lastWatchedAt TEXT NOT NULL,
  positionSeconds INTEGER
);
CREATE INDEX IF NOT EXISTS idx_history_lastWatched ON history(lastWatchedAt DESC);

CREATE TABLE IF NOT EXISTS epg_programs (
  id TEXT PRIMARY KEY NOT NULL,
  channelTvgId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  startMs INTEGER NOT NULL,
  endMs INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_epg_channel_time ON epg_programs(channelTvgId, startMs);
`;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('infiny-stream.db');
      await db.execAsync(SCHEMA);
      return db;
    })();
  }
  return dbPromise;
}

/** Test/dev helper — wipes all local data (does not touch account/subscription state, which lives server-side). */
export async function resetLocalDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM channels;
    DELETE FROM sources;
    DELETE FROM favorites;
    DELETE FROM history;
    DELETE FROM epg_programs;
  `);
}
