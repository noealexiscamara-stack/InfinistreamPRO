import type { Channel, ChannelCategory, ContentKind } from '@infiny-stream/types';
import { getDatabase } from '@/utils/db';

export interface ChannelQueryOptions {
  category?: string;
  kind?: ContentKind;
  limit?: number;
  offset?: number;
}

export async function countChannels(
  options: { sourceId?: string; kind?: ContentKind; category?: string } = {}
): Promise<number> {
  const db = await getDatabase();
  const { sourceId, kind, category } = options;

  if (sourceId && category && kind) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND category = ? AND kind = ?`,
      sourceId,
      category,
      kind
    );
    return row?.count ?? 0;
  }
  if (sourceId && category) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND category = ?`,
      sourceId,
      category
    );
    return row?.count ?? 0;
  }
  if (sourceId && kind) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND kind = ?`,
      sourceId,
      kind
    );
    return row?.count ?? 0;
  }
  if (sourceId) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM channels WHERE sourceId = ?`,
      sourceId
    );
    return row?.count ?? 0;
  }
  if (kind) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM channels WHERE kind = ?`,
      kind
    );
    return row?.count ?? 0;
  }

  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM channels`);
  return row?.count ?? 0;
}

export async function getKindCounts(sourceId?: string): Promise<Record<ContentKind, number>> {
  const db = await getDatabase();
  const empty: Record<ContentKind, number> = { live: 0, movie: 0, series: 0, radio: 0 };

  const countKind = async (kind: ContentKind): Promise<number> => {
    const row = sourceId
      ? await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND kind = ?`,
          sourceId,
          kind
        )
      : await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM channels WHERE kind = ?`, kind);
    return row?.count ?? 0;
  };

  empty.live = await countKind('live');
  empty.movie = await countKind('movie');
  empty.radio = await countKind('radio');

  const xtreamHeaderRow = sourceId
    ? await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL`,
        sourceId
      )
    : await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM channels WHERE kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL`
      );

  const m3uSeriesRow = sourceId
    ? await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND kind = 'series' AND xtreamSeriesId IS NULL AND xtreamEpisodeId IS NULL AND streamUrl NOT LIKE 'infiny-stream://%'`,
        sourceId
      )
    : await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM channels WHERE kind = 'series' AND xtreamSeriesId IS NULL AND xtreamEpisodeId IS NULL AND streamUrl NOT LIKE 'infiny-stream://%'`
      );

  empty.series = (xtreamHeaderRow?.count ?? 0) + (m3uSeriesRow?.count ?? 0);
  return empty;
}

export async function getCategories(sourceId: string, kind?: ContentKind): Promise<ChannelCategory[]> {
  const db = await getDatabase();
  const rows = kind
    ? await db.getAllAsync<{ category: string | null; count: number }>(
        `SELECT category, COUNT(*) as count FROM channels WHERE sourceId = ? AND kind = ? GROUP BY category ORDER BY category COLLATE NOCASE ASC`,
        sourceId,
        kind
      )
    : await db.getAllAsync<{ category: string | null; count: number }>(
        `SELECT category, COUNT(*) as count FROM channels WHERE sourceId = ? GROUP BY category ORDER BY category COLLATE NOCASE ASC`,
        sourceId
      );
  return rows
    .filter((r) => r.category)
    .map((r) => ({ id: `${sourceId}::${r.category}`, sourceId, name: r.category as string, channelCount: r.count }));
}

/** Categories aggregated across all sources for a content kind (Films / Séries browser). */
export async function getAllCategoriesByKind(kind: ContentKind): Promise<ChannelCategory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ category: string | null; count: number }>(
    `SELECT category, COUNT(*) as count FROM channels WHERE kind = ? AND category IS NOT NULL AND TRIM(category) != ''
     GROUP BY category ORDER BY category COLLATE NOCASE ASC`,
    kind
  );
  return rows
    .filter((r) => r.category)
    .map((r) => ({
      id: `kind:${kind}::${r.category}`,
      sourceId: '',
      name: r.category as string,
      channelCount: r.count,
    }));
}

export async function getAllChannelsByKindAndCategory(
  kind: ContentKind,
  category: string | null,
  limit = 120,
  offset = 0
): Promise<Channel[]> {
  const db = await getDatabase();
  if (category) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE kind = ? AND category = ? ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
      kind,
      category,
      limit,
      offset
    );
  }
  return getAllChannelsByKind(kind, limit, offset);
}

export async function getChannels(sourceId: string, options: ChannelQueryOptions = {}): Promise<Channel[]> {
  const db = await getDatabase();
  const { category, kind, limit = 500, offset = 0 } = options;

  if (category && kind) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE sourceId = ? AND category = ? AND kind = ? ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
      sourceId,
      category,
      kind,
      limit,
      offset
    );
  }
  if (category) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE sourceId = ? AND category = ? ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
      sourceId,
      category,
      limit,
      offset
    );
  }
  if (kind) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE sourceId = ? AND kind = ? ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
      sourceId,
      kind,
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

export async function getAllChannelsByKind(kind: ContentKind, limit = 120, offset = 0): Promise<Channel[]> {
  const db = await getDatabase();
  return db.getAllAsync<Channel>(
    `SELECT * FROM channels WHERE kind = ? ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
    kind,
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

export async function getChannelByXtreamSeriesId(sourceId: string, xtreamSeriesId: number): Promise<Channel | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Channel>(
    `SELECT * FROM channels WHERE sourceId = ? AND xtreamSeriesId = ? AND xtreamEpisodeId IS NULL LIMIT 1`,
    sourceId,
    xtreamSeriesId
  );
}

export async function getXtreamSeriesCatalog(
  limit = 120,
  offset = 0,
  category?: string | null
): Promise<Channel[]> {
  const db = await getDatabase();
  if (category) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL
       AND category = ? ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
      category,
      limit,
      offset
    );
  }
  return db.getAllAsync<Channel>(
    `SELECT * FROM channels WHERE kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
    limit,
    offset
  );
}

/** Series categories only for Xtream catalog headers (excludes M3U episode rows). */
export async function getXtreamSeriesCategories(): Promise<ChannelCategory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ category: string | null; count: number }>(
    `SELECT category, COUNT(*) as count FROM channels
     WHERE kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL
       AND category IS NOT NULL AND TRIM(category) != ''
     GROUP BY category ORDER BY category COLLATE NOCASE ASC`
  );
  return rows
    .filter((r) => r.category)
    .map((r) => ({
      id: `kind:series::${r.category}`,
      sourceId: '',
      name: r.category as string,
      channelCount: r.count,
    }));
}

export async function getSeriesEpisodes(sourceId: string, xtreamSeriesId: number): Promise<Channel[]> {
  const db = await getDatabase();
  return db.getAllAsync<Channel>(
    `SELECT * FROM channels WHERE sourceId = ? AND xtreamSeriesId = ? AND xtreamEpisodeId IS NOT NULL ORDER BY sortIndex ASC`,
    sourceId,
    xtreamSeriesId
  );
}

/** Diagnostic: titles that appear more than once among movies (proof for dedupe work). */
export async function getDuplicateMovieTitles(limit = 20): Promise<Array<{ title: string; count: number }>> {
  const db = await getDatabase();
  return db.getAllAsync<{ title: string; count: number }>(
    `SELECT name AS title, COUNT(*) AS count FROM channels WHERE kind = 'movie'
     GROUP BY name HAVING COUNT(*) > 1 ORDER BY count DESC LIMIT ?`,
    limit
  );
}

export async function countMovies(): Promise<number> {
  return countChannels({ kind: 'movie' });
}
