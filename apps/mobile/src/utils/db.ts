import * as SQLite from 'expo-sqlite';
import { INITIAL_SCHEMA, runSchemaMigrations, type AppDatabase, type MigrationDb } from '@/utils/dbMigrations';

const DATABASE_NAME = 'infiny-stream.db';

let dbPromise: Promise<AppDatabase> | null = null;

async function openAndMigrate(): Promise<AppDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync(INITIAL_SCHEMA);
  await runSchemaMigrations(db as unknown as MigrationDb);
  return db;
}

export async function getDatabase(): Promise<AppDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

/** Clears the singleton so the next getDatabase() opens a fresh connection. */
export function resetDatabaseConnection(): void {
  dbPromise = null;
}

/**
 * Deletes the on-device SQLite database including WAL sidecar files.
 * Checkpoints and closes any open handle first so no orphaned -wal/-shm remain.
 */
export async function deleteLocalDatabase(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      try {
        await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
      } catch {
        /* database may already be unusable */
      }
      await db.closeAsync();
    } catch {
      /* connection may already be broken */
    }
  }
  resetDatabaseConnection();
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
}

export type { ContentKind as ChannelKind } from '@infiny-stream/types';

/** Wipes rows but keeps the schema — useful in tests. */
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
