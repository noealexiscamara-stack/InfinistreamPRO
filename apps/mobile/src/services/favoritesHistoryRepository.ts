import type { Channel, FavoriteChannel, HistoryEntry } from '@infiny-stream/types';
import { getDatabase } from '@/utils/db';

const MAX_HISTORY_ENTRIES = 100;

export async function listFavorites(): Promise<FavoriteChannel[]> {
  const db = await getDatabase();
  return db.getAllAsync<FavoriteChannel>('SELECT * FROM favorites ORDER BY addedAt DESC');
}

/** Favorites joined with their channel metadata, for rendering (Home "Favoris" section, Favoris tab). */
export async function listFavoriteChannels(limit = 50, includeAdult = false): Promise<Channel[]> {
  const db = await getDatabase();
  const adult = includeAdult ? '1=1' : '(c.isAdult IS NULL OR c.isAdult = 0)';
  return db.getAllAsync<Channel>(
    `SELECT c.* FROM favorites f
     JOIN channels c ON c.id = f.channelId
     WHERE ${adult}
     ORDER BY f.addedAt DESC
     LIMIT ?`,
    limit
  );
}

export async function isFavorite(channelId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT 1 FROM favorites WHERE channelId = ?', channelId);
  return row !== null;
}

export async function addFavorite(channelId: string, sourceId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO favorites (channelId, sourceId, addedAt) VALUES (?, ?, ?)',
    channelId,
    sourceId,
    new Date().toISOString()
  );
}

export async function removeFavorite(channelId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM favorites WHERE channelId = ?', channelId);
}

export async function listHistory(limit = 20): Promise<HistoryEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<HistoryEntry>('SELECT * FROM history ORDER BY lastWatchedAt DESC LIMIT ?', limit);
}

/** Records/updates a "continuer à regarder" entry and trims old history beyond MAX_HISTORY_ENTRIES. */
export async function recordHistory(entry: Omit<HistoryEntry, 'lastWatchedAt'>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO history (channelId, sourceId, channelName, logoUrl, lastWatchedAt, positionSeconds)
     VALUES (?, ?, ?, ?, ?, ?)`,
    entry.channelId,
    entry.sourceId,
    entry.channelName,
    entry.logoUrl ?? null,
    new Date().toISOString(),
    entry.positionSeconds ?? null
  );

  await db.runAsync(
    `DELETE FROM history WHERE channelId NOT IN (
       SELECT channelId FROM history ORDER BY lastWatchedAt DESC LIMIT ?
     )`,
    MAX_HISTORY_ENTRIES
  );
}

export async function clearHistory(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM history');
}
