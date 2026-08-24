import {
  ARRAY_APPEND_BATCH,
  batchesOf,
  channelId,
  classifyEntry,
  classifyM3uEntry,
  dedupeChannelsByUrl,
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

/**
 * Replaces all channels for a source. Runs inside a single SQLite transaction
 * and inserts in batches of ARRAY_APPEND_BATCH so a 50k+ Xtream catalog does
 * not blow the call stack or leave a half-written source on failure.
 */
export async function replaceSourceChannels(
  sourceId: string,
  channels: PersistableChannel[],
  options?: { sourceType?: Source['type']; onProgress?: (processedCount: number, totalCount: number) => void }
): Promise<PersistChannelsResult> {
  const { channels: unique, duplicatesRemoved } = dedupeChannelsByUrl(channels);
  const tagged = withKind(unique, options?.sourceType);

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
  // Live-only grouping — consultative; must not allocate via spread of the full list.
  const liveOnly: Channel[] = [];
  for (const c of asChannels) {
    if (c.kind === 'live') liveOnly.push(c);
  }
  groupChannelsByQuality(liveOnly);

  const db = await getDatabase();
  let imported = 0;
  let rejected = 0;
  const saveTotal = tagged.length;

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM channels WHERE sourceId = ?', sourceId);
    await db.runAsync('DELETE FROM xtream_series_cache WHERE sourceId = ?', sourceId);

    if (tagged.length > 0) {
      const statement = await db.prepareAsync(
        `INSERT OR REPLACE INTO channels
          (id, sourceId, name, streamUrl, logoUrl, groupTitle, tvgId, tvgName, country, category, sortIndex, kind,
           plot, genre, rating, releaseDate, containerExtension, xtreamStreamId, xtreamSeriesId, xtreamEpisodeId)
         VALUES ($id, $sourceId, $name, $streamUrl, $logoUrl, $groupTitle, $tvgId, $tvgName, $country, $category, $sortIndex, $kind,
           $plot, $genre, $rating, $releaseDate, $containerExtension, $xtreamStreamId, $xtreamSeriesId, $xtreamEpisodeId)`
      );
      try {
        for (const batch of batchesOf(tagged, ARRAY_APPEND_BATCH)) {
          for (const ch of batch) {
            try {
              await statement.executeAsync({
                $id: channelId(sourceId, ch.streamUrl),
                $sourceId: sourceId,
                $name: ch.name,
                $streamUrl: ch.streamUrl,
                $logoUrl: ch.logoUrl ?? null,
                $groupTitle: ch.groupTitle ?? null,
                $tvgId: ch.tvgId ?? null,
                $tvgName: ch.tvgName ?? null,
                $country: ch.country ?? null,
                $category: ch.category ?? null,
                $sortIndex: ch.sortIndex,
                $kind: ch.kind,
                $plot: ch.plot ?? null,
                $genre: ch.genre ?? null,
                $rating: ch.rating ?? null,
                $releaseDate: ch.releaseDate ?? null,
                $containerExtension: ch.containerExtension ?? null,
                $xtreamStreamId: ch.xtreamStreamId ?? null,
                $xtreamSeriesId: ch.xtreamSeriesId ?? null,
                $xtreamEpisodeId: ch.xtreamEpisodeId ?? null,
              });
              imported++;
            } catch {
              rejected++;
            }
          }
          options?.onProgress?.(imported + rejected, saveTotal);
        }
      } finally {
        await statement.finalizeAsync();
      }
    }

    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE sources SET channelCount = ?, lastRefreshedAt = ?, lastError = NULL, updatedAt = ? WHERE id = ?`,
      imported,
      now,
      now,
      sourceId
    );
  });

  return { imported, duplicatesRemoved, rejected };
}

/** Upserts episode rows fetched from getSeriesInfo — does not wipe the whole source. */
export async function upsertSeriesEpisodes(sourceId: string, episodes: PersistableChannel[]): Promise<number> {
  const db = await getDatabase();
  let saved = 0;
  const statement = await db.prepareAsync(
    `INSERT OR REPLACE INTO channels
      (id, sourceId, name, streamUrl, logoUrl, groupTitle, category, sortIndex, kind,
       plot, containerExtension, xtreamEpisodeId, xtreamSeriesId)
     VALUES ($id, $sourceId, $name, $streamUrl, $logoUrl, $groupTitle, $category, $sortIndex, $kind,
       $plot, $containerExtension, $xtreamEpisodeId, $xtreamSeriesId)`
  );
  try {
    for (const batch of batchesOf(episodes, ARRAY_APPEND_BATCH)) {
      for (const ch of batch) {
        await statement.executeAsync({
          $id: channelId(sourceId, ch.streamUrl),
          $sourceId: sourceId,
          $name: ch.name,
          $streamUrl: ch.streamUrl,
          $logoUrl: ch.logoUrl ?? null,
          $groupTitle: ch.groupTitle ?? null,
          $category: ch.category ?? null,
          $sortIndex: ch.sortIndex,
          $kind: 'series',
          $plot: ch.plot ?? null,
          $containerExtension: ch.containerExtension ?? null,
          $xtreamEpisodeId: ch.xtreamEpisodeId ?? null,
          $xtreamSeriesId: ch.xtreamSeriesId ?? null,
        });
        saved++;
      }
    }
  } finally {
    await statement.finalizeAsync();
  }
  return saved;
}

export function xtreamSeriesPlaceholderUrl(sourceId: string, seriesId: number): string {
  return `infiny-stream://xtream/series/${sourceId}/${seriesId}`;
}

export function isXtreamSeriesPlaceholder(streamUrl: string): boolean {
  return streamUrl.startsWith('infiny-stream://xtream/series/');
}
