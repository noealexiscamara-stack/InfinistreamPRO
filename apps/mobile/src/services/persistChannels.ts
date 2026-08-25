import {
  batchesOf,
  channelId,
  classifyEntry,
  classifyM3uEntry,
  dedupeChannelsByUrl,
  dedupeXtreamByProviderId,
  groupChannelsByQuality,
} from '@infiny-stream/shared';
import type { Channel, ContentKind, Source } from '@infiny-stream/types';
import { getDatabase } from '@/utils/db';
import type { PersistableChannel } from '@/services/xtream/mapXtreamCatalog';

export type { PersistableChannel };

export interface PersistChannelsResult {
  imported: number;
  duplicatesRemoved: number;
  rejected: number;
  /** Rows written per second during the SQLite phase (for diagnostics). */
  rowsPerSecond?: number;
  /** Number of native bridge calls used for inserts. */
  nativeInsertCalls?: number;
}

/**
 * Rows per multi-row INSERT. 500 × 21 bind params = 10 500 variables —
 * well under SQLite's default SQLITE_MAX_VARIABLE_NUMBER (32 766).
 * One native call per batch instead of one per row.
 */
export const CHANNEL_INSERT_BATCH_ROWS = 500;

const CHANNEL_INSERT_COLUMNS = [
  'id',
  'sourceId',
  'name',
  'streamUrl',
  'logoUrl',
  'groupTitle',
  'tvgId',
  'tvgName',
  'country',
  'category',
  'xtreamCategoryId',
  'sortIndex',
  'kind',
  'plot',
  'genre',
  'rating',
  'releaseDate',
  'containerExtension',
  'xtreamStreamId',
  'xtreamSeriesId',
  'xtreamEpisodeId',
] as const;

const CHANNEL_INSERT_COL_COUNT = CHANNEL_INSERT_COLUMNS.length;

/** Cached SQL templates keyed by row count so we never rebuild the string per batch size thrash. */
const multiRowInsertSqlCache = new Map<number, string>();

export function buildMultiRowInsertSql(rowCount: number): string {
  const cached = multiRowInsertSqlCache.get(rowCount);
  if (cached) return cached;

  const cols = CHANNEL_INSERT_COLUMNS.join(', ');
  const oneRow = `(${Array.from({ length: CHANNEL_INSERT_COL_COUNT }, () => '?').join(',')})`;
  const values = Array.from({ length: rowCount }, () => oneRow).join(',');
  const sql = `INSERT OR REPLACE INTO channels (${cols}) VALUES ${values}`;
  multiRowInsertSqlCache.set(rowCount, sql);
  return sql;
}

export function formatImportSummary(imported: number, ignored: number): string {
  if (ignored > 0) return `${imported} chaînes importées, ${ignored} ignorées`;
  return `${imported} chaînes importées`;
}

function withKind(
  channels: PersistableChannel[],
  sourceType?: Source['type']
): Array<PersistableChannel & { kind: ContentKind }> {
  const classify =
    sourceType === 'm3u_url' || sourceType === 'm3u_file' ? classifyM3uEntry : classifyEntry;
  return channels.map((ch) => ({ ...ch, kind: ch.kind ?? classify(ch) }));
}

type TaggedChannel = PersistableChannel & { kind: ContentKind };

type BindValue = string | number | null;

function bindRowParams(sourceId: string, ch: TaggedChannel): BindValue[] {
  return [
    channelId(sourceId, ch.streamUrl),
    sourceId,
    ch.name,
    ch.streamUrl,
    ch.logoUrl ?? null,
    ch.groupTitle ?? null,
    ch.tvgId ?? null,
    ch.tvgName ?? null,
    ch.country ?? null,
    ch.category ?? null,
    ch.xtreamCategoryId ?? null,
    ch.sortIndex,
    ch.kind,
    ch.plot ?? null,
    ch.genre ?? null,
    ch.rating ?? null,
    ch.releaseDate ?? null,
    ch.containerExtension ?? null,
    ch.xtreamStreamId ?? null,
    ch.xtreamSeriesId ?? null,
    ch.xtreamEpisodeId ?? null,
  ];
}

/** At most one progress callback per second — avoids React re-render storms. */
function createThrottledProgress(
  onProgress: ((processed: number, total: number) => void) | undefined,
  minIntervalMs = 1000
): (processed: number, total: number) => void {
  if (!onProgress) return () => undefined;
  let lastMs = 0;
  let lastProcessed = -1;
  return (processed, total) => {
    const now = Date.now();
    const isFinal = processed >= total;
    if (!isFinal && processed === lastProcessed) return;
    if (!isFinal && now - lastMs < minIntervalMs) return;
    lastMs = now;
    lastProcessed = processed;
    onProgress(processed, total);
  };
}

/**
 * Replaces all channels for a source. Multi-row INSERTs (500 rows / call) keep
 * the JS↔native bridge off the hot path — critical for 100k–300k Xtream catalogs.
 */
export async function replaceSourceChannels(
  sourceId: string,
  channels: PersistableChannel[],
  options?: { sourceType?: Source['type']; onProgress?: (processedCount: number, totalCount: number) => void }
): Promise<PersistChannelsResult> {
  const { channels: uniqueByUrl, duplicatesRemoved: urlDupes } = dedupeChannelsByUrl(channels);
  const taggedRaw = withKind(uniqueByUrl, options?.sourceType);
  const { channels: tagged, duplicatesRemoved: providerDupes } = dedupeXtreamByProviderId(taggedRaw);
  const duplicatesRemoved = urlDupes + providerDupes;
  if (providerDupes > 0) {
    console.log(`[Import] dropped ${providerDupes} Xtream rows with duplicate provider stream/series id`);
  }

  const asChannels: Channel[] = [];
  for (const ch of tagged) {
    asChannels.push({
      id: channelId(sourceId, ch.streamUrl),
      sourceId,
      name: ch.name,
      streamUrl: ch.streamUrl,
      logoUrl: ch.logoUrl,
      groupTitle: ch.groupTitle,
      tvgId: ch.tvgId,
      tvgName: ch.tvgName,
      country: ch.country,
      category: ch.category,
      xtreamCategoryId: ch.xtreamCategoryId,
      sortIndex: ch.sortIndex,
      kind: ch.kind,
      plot: ch.plot,
      genre: ch.genre,
      rating: ch.rating,
      releaseDate: ch.releaseDate,
      containerExtension: ch.containerExtension,
      xtreamStreamId: ch.xtreamStreamId,
      xtreamSeriesId: ch.xtreamSeriesId,
      xtreamEpisodeId: ch.xtreamEpisodeId,
    });
  }
  const liveOnly: Channel[] = [];
  for (const c of asChannels) {
    if (c.kind === 'live') liveOnly.push(c);
  }
  groupChannelsByQuality(liveOnly);

  const db = await getDatabase();
  let imported = 0;
  let rejected = 0;
  let nativeInsertCalls = 0;
  const saveTotal = tagged.length;
  const reportProgress = createThrottledProgress(options?.onProgress);

  const startedAt = Date.now();

  // Durability can wait until commit — sync OFF + WAL cuts fsync cost during bulk write.
  const priorJournal = await db.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode');
  await db.execAsync('PRAGMA synchronous = OFF');
  await db.execAsync('PRAGMA journal_mode = WAL');
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM channels WHERE sourceId = ?', sourceId);
      await db.runAsync('DELETE FROM xtream_series_cache WHERE sourceId = ?', sourceId);

      if (tagged.length > 0) {
        // Pre-build SQL for full batches; rebuild only for a short tail.
        const fullBatchSql = buildMultiRowInsertSql(CHANNEL_INSERT_BATCH_ROWS);

        for (const batch of batchesOf(tagged, CHANNEL_INSERT_BATCH_ROWS)) {
          const params: BindValue[] = [];
          for (const ch of batch) {
            const row = bindRowParams(sourceId, ch);
            for (let i = 0; i < row.length; i++) params.push(row[i]);
          }

          const sql =
            batch.length === CHANNEL_INSERT_BATCH_ROWS ? fullBatchSql : buildMultiRowInsertSql(batch.length);

          try {
            // Single native call for the whole batch — never await per row.
            await db.runAsync(sql, ...params);
            imported += batch.length;
            nativeInsertCalls += 1;
          } catch {
            // Fall back to smaller chunks if the multi-row statement fails (e.g. bind limit).
            for (const ch of batch) {
              try {
                await db.runAsync(buildMultiRowInsertSql(1), ...bindRowParams(sourceId, ch));
                imported += 1;
                nativeInsertCalls += 1;
              } catch {
                rejected += 1;
              }
            }
          }

          reportProgress(imported + rejected, saveTotal);
        }
      }

      reportProgress(imported + rejected, saveTotal);

      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE sources SET channelCount = ?, lastRefreshedAt = ?, lastError = NULL, updatedAt = ? WHERE id = ?`,
        imported,
        now,
        now,
        sourceId
      );
    });
  } finally {
    await db.execAsync('PRAGMA synchronous = NORMAL');
    const mode = priorJournal?.journal_mode?.toUpperCase() === 'DELETE' ? 'DELETE' : 'WAL';
    await db.execAsync(`PRAGMA journal_mode = ${mode}`);
  }

  const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000);
  const rowsPerSecond = Math.round(imported / elapsedSec);
  console.log(
    `[Import] SQLite write ${imported} rows in ${elapsedSec.toFixed(2)}s → ${rowsPerSecond} rows/s (${nativeInsertCalls} native calls)`
  );

  return { imported, duplicatesRemoved, rejected, rowsPerSecond, nativeInsertCalls };
}

/** Upserts episode rows fetched from getSeriesInfo — does not wipe the whole source. */
export async function upsertSeriesEpisodes(sourceId: string, episodes: PersistableChannel[]): Promise<number> {
  const db = await getDatabase();
  let saved = 0;

  await db.execAsync('PRAGMA synchronous = OFF');
  try {
    for (const batch of batchesOf(episodes, CHANNEL_INSERT_BATCH_ROWS)) {
      const params: BindValue[] = [];
      for (const ch of batch) {
        // Reuse the same column layout; episodes leave some fields null.
        const tagged = { ...ch, kind: 'series' as const };
        const row = bindRowParams(sourceId, tagged);
        for (let i = 0; i < row.length; i++) params.push(row[i]);
      }
      await db.runAsync(buildMultiRowInsertSql(batch.length), ...params);
      saved += batch.length;
    }
  } finally {
    await db.execAsync('PRAGMA synchronous = NORMAL');
  }
  return saved;
}

export function xtreamSeriesPlaceholderUrl(sourceId: string, seriesId: number): string {
  return `infiny-stream://xtream/series/${sourceId}/${seriesId}`;
}

export function isXtreamSeriesPlaceholder(streamUrl: string): boolean {
  return streamUrl.startsWith('infiny-stream://xtream/series/');
}
