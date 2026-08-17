import type { Channel, ChannelCategory } from '@infiny-stream/types';
import { getDatabase } from '@/utils/db';

/**
 * All queries here run against SQLite indexes (see utils/db.ts) so they
 * stay fast on playlists with thousands of channels — nothing loads the
 * full channel table into memory at once except when a screen explicitly
 * needs a bounded page of it.
 */

export async function getCategories(sourceId: string): Promise<ChannelCategory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ category: string | null; count: number }>(
    `SELECT category, COUNT(*) as count FROM channels WHERE sourceId = ? GROUP BY category ORDER BY category COLLATE NOCASE ASC`,
    sourceId
  );
  return rows
    .filter((r) => r.category)
    .map((r) => ({ id: `${sourceId}::${r.category}`, sourceId, name: r.category as string, channelCount: r.count }));
}

export async function getChannels(
  sourceId: string,
  options: { category?: string; limit?: number; offset?: number } = {}
): Promise<Channel[]> {
  const db = await getDatabase();
  const { category, limit = 500, offset = 0 } = options;

  if (category) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE sourceId = ? AND category = ? ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
      sourceId,
      category,
      limit,
      offset
    );
  }

  return db.getAllAsync<Channel>(
    `SELECT * FROM channels WHERE sourceId = ? ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
    sourceId,
    limit,
    offset
  );
}

export async function searchChannels(sourceId: string | null, query: string, limit = 200): Promise<Channel[]> {
  const db = await getDatabase();
  const like = `%${query.trim()}%`;

  if (sourceId) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE sourceId = ? AND (name LIKE ? COLLATE NOCASE OR groupTitle LIKE ? COLLATE NOCASE OR country LIKE ? COLLATE NOCASE)
       ORDER BY name COLLATE NOCASE ASC LIMIT ?`,
      sourceId,
      like,
      like,
      like,
      limit
    );
  }

  return db.getAllAsync<Channel>(
    `SELECT * FROM channels WHERE (name LIKE ? COLLATE NOCASE OR groupTitle LIKE ? COLLATE NOCASE OR country LIKE ? COLLATE NOCASE)
     ORDER BY name COLLATE NOCASE ASC LIMIT ?`,
    like,
    like,
    like,
    limit
  );
}

export async function getChannelById(id: string): Promise<Channel | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Channel>('SELECT * FROM channels WHERE id = ?', id);
}
