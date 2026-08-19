import type { Channel, ChannelCategory, ContentKind } from '@infiny-stream/types';
import { groupEpisodesIntoSeries } from '@infiny-stream/shared';
import { getDatabase } from '@/utils/db';
import { isXtreamSeriesPlaceholder } from '@/services/persistChannels';

export interface ChannelQueryOptions {
  category?: string;
  kind?: ContentKind;
  limit?: number;
  offset?: number;
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

  const m3uSeriesRows = sourceId
    ? await getChannels(sourceId, { kind: 'series', limit: 50000 })
    : await getAllChannelsByKind('series', 50000);
  const m3uCandidates = m3uSeriesRows.filter(
    (c) => !c.xtreamSeriesId && !c.xtreamEpisodeId && !isXtreamSeriesPlaceholder(c.streamUrl)
  );
  const grouped = groupEpisodesIntoSeries(m3uCandidates);

  const xtreamHeaderRow = sourceId
    ? await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL`,
        sourceId
      )
    : await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM channels WHERE kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL`
      );

  empty.series = grouped.series.length + grouped.unparsed.length + (xtreamHeaderRow?.count ?? 0);
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

export async function getAllChannelsByKind(kind: ContentKind, limit = 10000): Promise<Channel[]> {
  const db = await getDatabase();
  return db.getAllAsync<Channel>(
    `SELECT * FROM channels WHERE kind = ? ORDER BY sortIndex ASC LIMIT ?`,
    kind,
    limit
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

export async function getXtreamSeriesCatalog(limit = 5000): Promise<Channel[]> {
  const db = await getDatabase();
  return db.getAllAsync<Channel>(
    `SELECT * FROM channels WHERE kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL ORDER BY sortIndex ASC LIMIT ?`,
    limit
  );
}

export async function getSeriesEpisodes(sourceId: string, xtreamSeriesId: number): Promise<Channel[]> {
  const db = await getDatabase();
  return db.getAllAsync<Channel>(
    `SELECT * FROM channels WHERE sourceId = ? AND xtreamSeriesId = ? AND xtreamEpisodeId IS NOT NULL ORDER BY sortIndex ASC`,
    sourceId,
    xtreamSeriesId
  );
}
