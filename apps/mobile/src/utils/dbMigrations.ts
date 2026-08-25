import type * as SQLite from 'expo-sqlite';
import { classifyEntry, classifyM3uEntry } from '@infiny-stream/shared';

/** Bump when adding a new incremental migration below. */
export const LATEST_SCHEMA_VERSION = 4;

export interface MigrationRunOptions {
  /** Test hook — simulates the app being killed mid-backfill. */
  failBackfillAfter?: number;
}

export interface MigrationDb {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  prepareAsync(sql: string): Promise<{
    executeAsync(params: Record<string, unknown>): Promise<unknown>;
    finalizeAsync(): Promise<void>;
  }>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export const INITIAL_SCHEMA = `
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

const METADATA_COLUMNS = [
  { name: 'plot', type: 'TEXT' },
  { name: 'genre', type: 'TEXT' },
  { name: 'rating', type: 'REAL' },
  { name: 'releaseDate', type: 'TEXT' },
  { name: 'containerExtension', type: 'TEXT' },
  { name: 'xtreamStreamId', type: 'INTEGER' },
  { name: 'xtreamSeriesId', type: 'INTEGER' },
  { name: 'xtreamEpisodeId', type: 'TEXT' },
] as const;

export async function columnExists(db: MigrationDb, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

export async function getSchemaVersion(db: MigrationDb): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function setSchemaVersion(db: MigrationDb, version: number): Promise<void> {
  await db.execAsync(`PRAGMA user_version = ${version}`);
}

async function backfillKindColumn(db: MigrationDb, options?: MigrationRunOptions): Promise<void> {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    streamUrl: string;
    groupTitle: string | null;
    category: string | null;
  }>(`SELECT id, name, streamUrl, groupTitle, category FROM channels`);

  if (rows.length === 0) return;

  const statement = await db.prepareAsync(`UPDATE channels SET kind = $kind WHERE id = $id`);
  try {
    let updated = 0;
    for (const row of rows) {
      let kind = 'live';
      try {
        kind = classifyEntry({
          name: row.name,
          streamUrl: row.streamUrl,
          groupTitle: row.groupTitle ?? row.category ?? undefined,
        });
      } catch {
        kind = 'live';
      }
      await statement.executeAsync({ $id: row.id, $kind: kind });
      updated += 1;
      if (options?.failBackfillAfter !== undefined && updated >= options.failBackfillAfter) {
        throw new Error('Migration interrompue pendant le backfill');
      }
    }
  } finally {
    await statement.finalizeAsync();
  }
}

/** v0 → v1 : content kind for universe routing. */
export async function migrateV1_addKind(db: MigrationDb, options?: MigrationRunOptions): Promise<void> {
  if (!(await columnExists(db, 'channels', 'kind'))) {
    await db.execAsync(`ALTER TABLE channels ADD COLUMN kind TEXT NOT NULL DEFAULT 'live'`);
  }
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_channels_kind ON channels(sourceId, kind)`);
  await backfillKindColumn(db, options);
}

/** v1 → v2 : VOD/series metadata + on-demand series cache. */
export async function migrateV2_metadataAndCache(db: MigrationDb): Promise<void> {
  for (const column of METADATA_COLUMNS) {
    if (await columnExists(db, 'channels', column.name)) continue;
    await db.execAsync(`ALTER TABLE channels ADD COLUMN ${column.name} ${column.type}`);
  }
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_channels_xtream_series ON channels(sourceId, xtreamSeriesId)`);
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

/** v2 → v3 : reclassify M3U channels as live (audio → radio); Xtream untouched. */
export async function migrateV3_reclassifyM3uKinds(db: MigrationDb): Promise<void> {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    streamUrl: string;
    groupTitle: string | null;
    category: string | null;
  }>(`
    SELECT c.id, c.name, c.streamUrl, c.groupTitle, c.category
    FROM channels c
    INNER JOIN sources s ON s.id = c.sourceId
    WHERE s.type IN ('m3u_url', 'm3u_file')
  `);

  if (rows.length === 0) return;

  const statement = await db.prepareAsync(`UPDATE channels SET kind = $kind WHERE id = $id`);
  try {
    for (const row of rows) {
      const kind = classifyM3uEntry({
        name: row.name,
        streamUrl: row.streamUrl,
        groupTitle: row.groupTitle ?? row.category ?? undefined,
      });
      await statement.executeAsync({ $id: row.id, $kind: kind });
    }
  } finally {
    await statement.finalizeAsync();
  }
}

/** v3 → v4 : store Xtream category_id separately from display name. */
export async function migrateV4_xtreamCategoryId(db: MigrationDb): Promise<void> {
  if (!(await columnExists(db, 'channels', 'xtreamCategoryId'))) {
    await db.execAsync(`ALTER TABLE channels ADD COLUMN xtreamCategoryId TEXT`);
  }
  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_channels_xtream_category ON channels(sourceId, kind, xtreamCategoryId)`
  );
}

async function runMigrationStep(
  db: MigrationDb,
  targetVersion: number,
  migrate: () => Promise<void>
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await migrate();
    await setSchemaVersion(db, targetVersion);
  });
}

export async function runSchemaMigrations(db: MigrationDb, options?: MigrationRunOptions): Promise<void> {
  let version = await getSchemaVersion(db);

  if (version < 1) {
    await runMigrationStep(db, 1, () => migrateV1_addKind(db, options));
    version = 1;
  }

  if (version < 2) {
    await runMigrationStep(db, 2, () => migrateV2_metadataAndCache(db));
    version = 2;
  }

  if (version < 3) {
    await runMigrationStep(db, 3, () => migrateV3_reclassifyM3uKinds(db));
    version = 3;
  }

  if (version < 4) {
    await runMigrationStep(db, 4, () => migrateV4_xtreamCategoryId(db));
    version = 4;
  }

  if (version > LATEST_SCHEMA_VERSION) {
    throw new Error(`Base locale plus récente que l'application (v${version}). Mettez l'app à jour.`);
  }
}

export type AppDatabase = SQLite.SQLiteDatabase;
