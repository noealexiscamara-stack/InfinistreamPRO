import type { Channel, ChannelCategory, ContentKind } from '@infiny-stream/types';
import { getDatabase } from '@/utils/db';

export interface ChannelQueryOptions {
  category?: string;
  kind?: ContentKind;
  limit?: number;
  offset?: number;
  /** When false (default), adult-flagged rows are excluded. */
  includeAdult?: boolean;
}

/** Adult content is hidden unless explicitly unlocked. */
function adultSql(includeAdult: boolean | undefined, alias?: string): string {
  if (includeAdult) return '1=1';
  const col = alias ? `${alias}.isAdult` : 'isAdult';
  return `(${col} IS NULL OR ${col} = 0)`;
}

export async function countChannels(
  options: {
    sourceId?: string;
    kind?: ContentKind;
    category?: string;
    includeAdult?: boolean;
  } = {}
): Promise<number> {
  const db = await getDatabase();
  const { sourceId, kind, category, includeAdult } = options;
  const adult = adultSql(includeAdult);

  if (sourceId && category && kind) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND category = ? AND kind = ? AND ${adult}`,
      sourceId,
      category,
      kind
    );
    return row?.count ?? 0;
  }
  if (sourceId && category) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND category = ? AND ${adult}`,
      sourceId,
      category
    );
    return row?.count ?? 0;
  }
  if (sourceId && kind) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND kind = ? AND ${adult}`,
      sourceId,
      kind
    );
    return row?.count ?? 0;
  }
  if (sourceId) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND ${adult}`,
      sourceId
    );
    return row?.count ?? 0;
  }
  if (kind) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM channels WHERE kind = ? AND ${adult}`,
      kind
    );
    return row?.count ?? 0;
  }

  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM channels WHERE ${adult}`
  );
  return row?.count ?? 0;
}

export async function getKindCounts(
  sourceId?: string,
  includeAdult = false
): Promise<Record<ContentKind, number>> {
  const db = await getDatabase();
  const empty: Record<ContentKind, number> = { live: 0, movie: 0, series: 0, radio: 0 };
  const adult = adultSql(includeAdult);

  const countKind = async (kind: ContentKind): Promise<number> => {
    const row = sourceId
      ? await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND kind = ? AND ${adult}`,
          sourceId,
          kind
        )
      : await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM channels WHERE kind = ? AND ${adult}`,
          kind
        );
    return row?.count ?? 0;
  };

  empty.live = await countKind('live');
  empty.movie = await countKind('movie');
  empty.radio = await countKind('radio');

  const xtreamHeaderRow = sourceId
    ? await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL AND ${adult}`,
        sourceId
      )
    : await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM channels WHERE kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL AND ${adult}`
      );

  const m3uSeriesRow = sourceId
    ? await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND kind = 'series' AND xtreamSeriesId IS NULL AND xtreamEpisodeId IS NULL AND streamUrl NOT LIKE 'infiny-stream://%' AND ${adult}`,
        sourceId
      )
    : await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM channels WHERE kind = 'series' AND xtreamSeriesId IS NULL AND xtreamEpisodeId IS NULL AND streamUrl NOT LIKE 'infiny-stream://%' AND ${adult}`
      );

  empty.series = (xtreamHeaderRow?.count ?? 0) + (m3uSeriesRow?.count ?? 0);
  return empty;
}

export async function getCategories(
  sourceId: string,
  kind?: ContentKind,
  includeAdult = false
): Promise<ChannelCategory[]> {
  const db = await getDatabase();
  const adult = adultSql(includeAdult);
  const rows = kind
    ? await db.getAllAsync<{ category: string | null; count: number; isAdult: number }>(
        `SELECT category, COUNT(*) as count, MAX(isAdult) as isAdult FROM channels
         WHERE sourceId = ? AND kind = ? AND ${adult}
         GROUP BY category ORDER BY category COLLATE NOCASE ASC`,
        sourceId,
        kind
      )
    : await db.getAllAsync<{ category: string | null; count: number; isAdult: number }>(
        `SELECT category, COUNT(*) as count, MAX(isAdult) as isAdult FROM channels
         WHERE sourceId = ? AND ${adult}
         GROUP BY category ORDER BY category COLLATE NOCASE ASC`,
        sourceId
      );
  return rows
    .filter((r) => r.category)
    .map((r) => ({
      id: `${sourceId}::${r.category}`,
      sourceId,
      name: r.category as string,
      channelCount: r.count,
      isAdult: r.isAdult === 1,
      kind,
    }));
}

/** Categories aggregated across all sources for a content kind (Films / Séries browser). */
export async function getAllCategoriesByKind(
  kind: ContentKind,
  includeAdult = false
): Promise<ChannelCategory[]> {
  const db = await getDatabase();
  const adult = adultSql(includeAdult);
  const rows = await db.getAllAsync<{ category: string | null; count: number; isAdult: number }>(
    `SELECT category, COUNT(*) as count, MAX(isAdult) as isAdult FROM channels
     WHERE kind = ? AND category IS NOT NULL AND TRIM(category) != '' AND ${adult}
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
      isAdult: r.isAdult === 1,
      kind,
    }));
}

export async function getAllChannelsByKindAndCategory(
  kind: ContentKind,
  category: string | null,
  limit = 120,
  offset = 0,
  includeAdult = false
): Promise<Channel[]> {
  const db = await getDatabase();
  const adult = adultSql(includeAdult);
  if (category) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE kind = ? AND category = ? AND ${adult} ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
      kind,
      category,
      limit,
      offset
    );
  }
  return getAllChannelsByKind(kind, limit, offset, includeAdult);
}

export async function getChannels(sourceId: string, options: ChannelQueryOptions = {}): Promise<Channel[]> {
  const db = await getDatabase();
  const { category, kind, limit = 500, offset = 0, includeAdult } = options;
  const adult = adultSql(includeAdult);

  if (category && kind) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE sourceId = ? AND category = ? AND kind = ? AND ${adult} ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
      sourceId,
      category,
      kind,
      limit,
      offset
    );
  }
  if (category) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE sourceId = ? AND category = ? AND ${adult} ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
      sourceId,
      category,
      limit,
      offset
    );
  }
  if (kind) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE sourceId = ? AND kind = ? AND ${adult} ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
      sourceId,
      kind,
      limit,
      offset
    );
  }

  return db.getAllAsync<Channel>(
    `SELECT * FROM channels WHERE sourceId = ? AND ${adult} ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
    sourceId,
    limit,
    offset
  );
}

export async function getAllChannelsByKind(
  kind: ContentKind,
  limit = 120,
  offset = 0,
  includeAdult = false
): Promise<Channel[]> {
  const db = await getDatabase();
  const adult = adultSql(includeAdult);
  return db.getAllAsync<Channel>(
    `SELECT * FROM channels WHERE kind = ? AND ${adult} ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
    kind,
    limit,
    offset
  );
}

export async function searchChannels(
  sourceId: string | null,
  query: string,
  limit = 200,
  includeAdult = false
): Promise<Channel[]> {
  const db = await getDatabase();
  const like = `%${query.trim()}%`;
  const adult = adultSql(includeAdult);

  if (sourceId) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE sourceId = ? AND ${adult} AND (name LIKE ? COLLATE NOCASE OR groupTitle LIKE ? COLLATE NOCASE OR country LIKE ? COLLATE NOCASE)
       ORDER BY name COLLATE NOCASE ASC LIMIT ?`,
      sourceId,
      like,
      like,
      like,
      limit
    );
  }

  return db.getAllAsync<Channel>(
    `SELECT * FROM channels WHERE ${adult} AND (name LIKE ? COLLATE NOCASE OR groupTitle LIKE ? COLLATE NOCASE OR country LIKE ? COLLATE NOCASE)
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
  category?: string | null,
  includeAdult = false
): Promise<Channel[]> {
  const db = await getDatabase();
  const adult = adultSql(includeAdult);
  if (category) {
    return db.getAllAsync<Channel>(
      `SELECT * FROM channels WHERE kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL
       AND category = ? AND ${adult} ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
      category,
      limit,
      offset
    );
  }
  return db.getAllAsync<Channel>(
    `SELECT * FROM channels WHERE kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL AND ${adult} ORDER BY sortIndex ASC LIMIT ? OFFSET ?`,
    limit,
    offset
  );
}

/** Series categories only for Xtream catalog headers (excludes M3U episode rows). */
export async function getXtreamSeriesCategories(includeAdult = false): Promise<ChannelCategory[]> {
  const db = await getDatabase();
  const adult = adultSql(includeAdult);
  const rows = await db.getAllAsync<{ category: string | null; count: number; isAdult: number }>(
    `SELECT category, COUNT(*) as count, MAX(isAdult) as isAdult FROM channels
     WHERE kind = 'series' AND xtreamSeriesId IS NOT NULL AND xtreamEpisodeId IS NULL
       AND category IS NOT NULL AND TRIM(category) != '' AND ${adult}
     GROUP BY category ORDER BY category COLLATE NOCASE ASC`
  );
  return rows
    .filter((r) => r.category)
    .map((r) => ({
      id: `kind:series::${r.category}`,
      sourceId: '',
      name: r.category as string,
      channelCount: r.count,
      isAdult: r.isAdult === 1,
      kind: 'series' as const,
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

export async function countMovies(includeAdult = false): Promise<number> {
  return countChannels({ kind: 'movie', includeAdult });
}

/**
 * Radios: explicit kind=radio, plus live streams whose category_name contains RADIO.
 */
export async function getRadioChannels(limit = 10000, includeAdult = false): Promise<Channel[]> {
  const db = await getDatabase();
  const adult = adultSql(includeAdult);
  return db.getAllAsync<Channel>(
    `SELECT * FROM channels
     WHERE ${adult} AND (
       kind = 'radio'
       OR (kind = 'live' AND (
              UPPER(IFNULL(category, '')) LIKE '%RADIO%'
           OR UPPER(IFNULL(groupTitle, '')) LIKE '%RADIO%'
       ))
     )
     ORDER BY sortIndex ASC LIMIT ?`,
    limit
  );
}

export interface ManagedCategoryRow {
  id: string;
  sourceId: string;
  kind: ContentKind;
  name: string;
  /** Effective adult flag (manual override wins over auto). */
  isAdult: boolean;
  adultAuto: boolean;
  /** null = follow auto; set when user toggled manually. */
  adultManualOverride: boolean | null;
  channelCount: number;
}

/** All category rows for parental management (includes adult + non-adult). */
export async function listManagedCategories(): Promise<ManagedCategoryRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    sourceId: string;
    kind: string;
    name: string;
    isAdult: number;
    adultAuto: number;
    adultManualOverride: number | null;
  }>(
    `SELECT id, sourceId, kind, name, isAdult, adultAuto, adultManualOverride
     FROM categories ORDER BY isAdult DESC, name COLLATE NOCASE ASC`
  );

  const withCounts: ManagedCategoryRow[] = [];
  for (const row of rows) {
    const countRow = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM channels WHERE sourceId = ? AND kind = ? AND category = ?`,
      row.sourceId,
      row.kind,
      row.name
    );
    withCounts.push({
      id: row.id,
      sourceId: row.sourceId,
      kind: row.kind as ContentKind,
      name: row.name,
      isAdult: row.isAdult === 1,
      adultAuto: row.adultAuto === 1,
      adultManualOverride:
        row.adultManualOverride == null ? null : row.adultManualOverride === 1,
      channelCount: countRow?.count ?? 0,
    });
  }
  return withCounts;
}

export async function countAdultCategories(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM categories WHERE isAdult = 1`
  );
  return row?.count ?? 0;
}

/**
 * Manual mark / unmark — stores adultManualOverride so reimport cannot wipe the decision.
 * isAdult (effective) and channel denormalized flags follow the override.
 */
export async function setCategoryAdultFlag(categoryId: string, isAdult: boolean): Promise<void> {
  const db = await getDatabase();
  const cat = await db.getFirstAsync<{ sourceId: string; kind: string; name: string }>(
    `SELECT sourceId, kind, name FROM categories WHERE id = ?`,
    categoryId
  );
  if (!cat) return;

  const flag = isAdult ? 1 : 0;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE categories SET adultManualOverride = ?, isAdult = ? WHERE id = ?`,
      flag,
      flag,
      categoryId
    );
    await db.runAsync(
      `UPDATE channels SET isAdult = ? WHERE sourceId = ? AND kind = ? AND category = ?`,
      flag,
      cat.sourceId,
      cat.kind,
      cat.name
    );
  });
}
