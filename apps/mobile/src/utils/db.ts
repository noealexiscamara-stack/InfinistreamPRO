import * as SQLite from 'expo-sqlite';
import { classifyEntry } from '@infiny-stream/shared';
import type { ContentKind } from '@infiny-stream/types';

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
  kind TEXT NOT NULL DEFAULT 'live',
  plot TEXT,
  genre TEXT,
  rating REAL,
  releaseDate TEXT,
  containerExtension TEXT,
  xtreamStreamId INTEGER,
  xtreamSeriesId INTEGER,
  xtreamEpisodeId TEXT,
  FOREIGN KEY (sourceId) REFERENCES sources(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_channels_source ON channels(sourceId);
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(sourceId, category);
CREATE INDEX IF NOT EXISTS idx_channels_kind ON channels(sourceId, kind);
CREATE INDEX IF NOT EXISTS idx_channels_xtream_series ON channels(sourceId, xtreamSeriesId);
CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS xtream_series_cache (
  sourceId TEXT NOT NULL,
  seriesId INTEGER NOT NULL,
  payload TEXT NOT NULL,
  fetchedAt TEXT NOT NULL,
  PRIMARY KEY (sourceId, seriesId)
);

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

const METADATA_COLUMNS = [
  'plot',
  'genre',
  'rating',
  'releaseDate',
  'containerExtension',
  'xtreamStreamId',
  'xtreamSeriesId',
  'xtreamEpisodeId',
] as const;

async function columnExists(db: SQLite.SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

async function migrateKindColumn(db: SQLite.SQLiteDatabase): Promise<void> {
  if (await columnExists(db, 'channels', 'kind')) return;

  await db.execAsync(`ALTER TABLE channels ADD COLUMN kind TEXT NOT NULL DEFAULT 'live'`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_channels_kind ON channels(sourceId, kind)`);

  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    streamUrl: string;
    groupTitle: string | null;
    category: string | null;
    tvgId: string | null;
  }>(`SELECT id, name, streamUrl, groupTitle, category, tvgId FROM channels`);

  if (rows.length === 0) return;

  const statement = await db.prepareAsync(`UPDATE channels SET kind = $kind WHERE id = $id`);
  try {
    for (const row of rows) {
      const kind = classifyEntry({
        name: row.name,
        streamUrl: row.streamUrl,
        groupTitle: row.groupTitle ?? undefined,
        category: row.category ?? undefined,
        tvgId: row.tvgId ?? undefined,
      });
      await statement.executeAsync({ $id: row.id, $kind: kind });
    }
  } finally {
    await statement.finalizeAsync();
  }
}

async function migrateMetadataColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const column of METADATA_COLUMNS) {
    if (await columnExists(db, 'channels', column)) continue;
    const sqlType =
      column === 'rating' || column === 'xtreamStreamId' || column === 'xtreamSeriesId'
        ? column.startsWith('xtream')
          ? 'INTEGER'
          : 'REAL'
        : 'TEXT';
    await db.execAsync(`ALTER TABLE channels ADD COLUMN ${column} ${sqlType}`);
  }
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_channels_xtream_series ON channels(sourceId, xtreamSeriesId)`);
}

async function migrateSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await migrateKindColumn(db);
  await migrateMetadataColumns(db);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS xtream_series_cache (
      sourceId TEXT NOT NULL,
      seriesId INTEGER NOT NULL,
      payload TEXT NOT NULL,
      fetchedAt TEXT NOT NULL,
      PRIMARY KEY (sourceId, seriesId)
    );
  `);
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('infiny-stream.db');
      await db.execAsync(SCHEMA);
      await migrateSchema(db);
      return db;
    })();
  }
  return dbPromise;
}

export type { ContentKind as ChannelKind };

export async function resetLocalDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM channels;
    DELETE FROM sources;
    DELETE FROM favorites;
    DELETE FROM history;
    DELETE FROM epg_programs;
    DELETE FROM xtream_series_cache;
  `);
}
