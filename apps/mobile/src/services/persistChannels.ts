import { channelId, classifyEntries, dedupeChannelsByUrl, groupChannelsByQuality } from '@infiny-stream/shared';
import type { Channel, ContentKind } from '@infiny-stream/types';
import { getDatabase } from '@/utils/db';

export interface PersistableChannel {
  name: string;
  streamUrl: string;
  logoUrl?: string;
  groupTitle?: string;
  tvgId?: string;
  tvgName?: string;
  country?: string;
  category?: string;
  sortIndex: number;
  kind?: ContentKind;
  plot?: string;
  genre?: string;
  rating?: number;
  releaseDate?: string;
  containerExtension?: string;
  xtreamStreamId?: number;
  xtreamSeriesId?: number;
  xtreamEpisodeId?: string;
}

export interface PersistChannelsResult {
  imported: number;
  duplicatesRemoved: number;
  rejected: number;
}

export function formatImportSummary(imported: number, ignored: number): string {
  if (ignored > 0) return `${imported} chaînes importées, ${ignored} ignorées`;
  return `${imported} chaînes importées`;
}

function withKind(channels: PersistableChannel[]): Array<PersistableChannel & { kind: ContentKind }> {
  return channels.map((ch) => ({ ...ch, kind: ch.kind ?? classifyEntries([ch])[0].kind }));
}

export async function replaceSourceChannels(
  sourceId: string,
  channels: PersistableChannel[]
): Promise<PersistChannelsResult> {
  const { channels: unique, duplicatesRemoved } = dedupeChannelsByUrl(channels);
  const tagged = withKind(unique);

  const asChannels: Channel[] = tagged.map((ch) => ({
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
  }));
  groupChannelsByQuality(asChannels.filter((c) => c.kind === 'live'));

  const db = await getDatabase();
  let imported = 0;
  let rejected = 0;

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
      for (const ch of tagged) {
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
    for (const ch of episodes) {
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
