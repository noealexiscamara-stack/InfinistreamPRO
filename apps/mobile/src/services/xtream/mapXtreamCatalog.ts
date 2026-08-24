import type {
  XtreamClient,
  XtreamLiveStream,
  XtreamSeries,
  XtreamSeriesInfo,
  XtreamVodStream,
} from '@infiny-stream/shared';
import { ARRAY_APPEND_BATCH } from '@infiny-stream/shared';
import type { ContentKind } from '@infiny-stream/types';
import type { XtreamImportProgress } from '@/services/xtream/importXtream';

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

function xtreamSeriesPlaceholderUrl(sourceId: string, seriesId: number): string {
  return `infiny-stream://xtream/series/${sourceId}/${seriesId}`;
}

export interface XtreamCatalogFetchResults {
  live: import('@infiny-stream/shared').XtreamResult<XtreamLiveStream[]>;
  vod: import('@infiny-stream/shared').XtreamResult<XtreamVodStream[]>;
  series: import('@infiny-stream/shared').XtreamResult<XtreamSeries[]>;
}

export interface BuildXtreamChannelsResult {
  channels: PersistableChannel[];
  vodAvailable: boolean;
  seriesAvailable: boolean;
  vodError?: string;
  seriesError?: string;
}

type StreamUrlBuilder = Pick<XtreamClient, 'buildLiveStreamUrl' | 'buildVodStreamUrl' | 'buildEpisodeStreamUrl'>;

/** Ratings of 0 mean "unknown" on many providers — never show them as a score. */
export function formatDisplayRating(rating?: number): string | null {
  if (rating == null || !Number.isFinite(rating) || rating <= 0) return null;
  return String(rating);
}

/**
 * Maps catalog rows into `out` in batches — never `push(...mapped)`.
 * Returns the number of rows appended.
 */
export function appendXtreamLiveStreams(
  out: PersistableChannel[],
  streams: XtreamLiveStream[],
  client: Pick<XtreamClient, 'buildLiveStreamUrl'>,
  categoryNameById: Map<string, string>,
  sortIndexStart = 0
): number {
  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i];
    const category = categoryNameById.get(stream.categoryId);
    out.push({
      name: stream.name,
      streamUrl: client.buildLiveStreamUrl(stream.streamId),
      logoUrl: stream.streamIcon,
      groupTitle: category,
      category,
      tvgId: stream.epgChannelId,
      sortIndex: sortIndexStart + i,
      kind: 'live',
    });
  }
  return streams.length;
}

export function appendXtreamVodStreams(
  out: PersistableChannel[],
  streams: XtreamVodStream[],
  client: Pick<XtreamClient, 'buildVodStreamUrl'>,
  categoryNameById: Map<string, string>,
  sortIndexStart = 0
): number {
  for (let i = 0; i < streams.length; i++) {
    const vod = streams[i];
    const category = categoryNameById.get(vod.categoryId);
    out.push({
      name: vod.name,
      streamUrl: client.buildVodStreamUrl(vod.streamId, vod.containerExtension),
      logoUrl: vod.icon,
      groupTitle: category,
      category,
      sortIndex: sortIndexStart + i,
      kind: 'movie',
      rating: vod.rating,
      releaseDate: vod.added,
      containerExtension: vod.containerExtension,
      xtreamStreamId: vod.streamId,
    });
  }
  return streams.length;
}

export function appendXtreamSeriesCatalog(
  out: PersistableChannel[],
  seriesList: XtreamSeries[],
  sourceId: string,
  categoryNameById: Map<string, string>,
  sortIndexStart = 0
): number {
  for (let i = 0; i < seriesList.length; i++) {
    const series = seriesList[i];
    const category = categoryNameById.get(series.categoryId);
    out.push({
      name: series.name,
      streamUrl: xtreamSeriesPlaceholderUrl(sourceId, series.seriesId),
      logoUrl: series.cover,
      groupTitle: category,
      category,
      sortIndex: sortIndexStart + i,
      kind: 'series',
      plot: series.plot,
      genre: series.genre,
      rating: series.rating,
      releaseDate: series.releaseDate,
      xtreamSeriesId: series.seriesId,
    });
  }
  return seriesList.length;
}

export function mapXtreamLiveStreams(
  streams: XtreamLiveStream[],
  client: Pick<XtreamClient, 'buildLiveStreamUrl'>,
  categoryNameById: Map<string, string>,
  sortIndexStart = 0
): PersistableChannel[] {
  const out: PersistableChannel[] = [];
  appendXtreamLiveStreams(out, streams, client, categoryNameById, sortIndexStart);
  return out;
}

export function mapXtreamVodStreams(
  streams: XtreamVodStream[],
  client: Pick<XtreamClient, 'buildVodStreamUrl'>,
  categoryNameById: Map<string, string>,
  sortIndexStart = 0
): PersistableChannel[] {
  const out: PersistableChannel[] = [];
  appendXtreamVodStreams(out, streams, client, categoryNameById, sortIndexStart);
  return out;
}

export function mapXtreamSeriesCatalog(
  seriesList: XtreamSeries[],
  sourceId: string,
  categoryNameById: Map<string, string>,
  sortIndexStart = 0
): PersistableChannel[] {
  const out: PersistableChannel[] = [];
  appendXtreamSeriesCatalog(out, seriesList, sourceId, categoryNameById, sortIndexStart);
  return out;
}

export function mapXtreamSeriesEpisodes(
  source: { id: string },
  seriesId: number,
  seriesTitle: string,
  info: XtreamSeriesInfo,
  client: Pick<XtreamClient, 'buildEpisodeStreamUrl'>
): PersistableChannel[] {
  const out: PersistableChannel[] = [];
  for (let index = 0; index < info.episodes.length; index++) {
    const ep = info.episodes[index];
    out.push({
      name: ep.title
        ? `${seriesTitle} S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')} — ${ep.title}`
        : `${seriesTitle} S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`,
      streamUrl: client.buildEpisodeStreamUrl(ep.episodeId, ep.containerExtension),
      groupTitle: seriesTitle,
      category: seriesTitle,
      sortIndex: index,
      kind: 'series',
      plot: ep.plot,
      containerExtension: ep.containerExtension,
      xtreamEpisodeId: ep.episodeId,
      xtreamSeriesId: seriesId,
    });
  }
  return out;
}

/**
 * Builds the full channel list for an Xtream import. Live failure aborts;
 * VOD/series failures are tolerated so a provider without films does not
 * block live TV import.
 *
 * Maps directly into one array — never spreads large catalogs onto the stack.
 */
export function buildXtreamChannelsFromFetch(
  sourceId: string,
  client: StreamUrlBuilder,
  categoryNameById: Map<string, string>,
  results: XtreamCatalogFetchResults,
  onProgress?: (progress: XtreamImportProgress) => void
): BuildXtreamChannelsResult {
  if (!results.live.ok) {
    throw new Error(results.live.message);
  }

  const channels: PersistableChannel[] = [];
  let sortIndex = 0;

  const liveTotal = results.live.data.length;
  onProgress?.({ phase: 'mapping', step: 'live', processedCount: 0, totalCount: liveTotal });
  sortIndex += appendXtreamLiveStreams(channels, results.live.data, client, categoryNameById, sortIndex);
  onProgress?.({ phase: 'mapping', step: 'live', processedCount: liveTotal, totalCount: liveTotal });

  let vodAvailable = false;
  let seriesAvailable = false;
  let vodError: string | undefined;
  let seriesError: string | undefined;

  if (results.vod.ok) {
    vodAvailable = true;
    const vod = results.vod.data;
    for (let i = 0; i < vod.length; i += ARRAY_APPEND_BATCH) {
      const slice = vod.slice(i, i + ARRAY_APPEND_BATCH);
      sortIndex += appendXtreamVodStreams(channels, slice, client, categoryNameById, sortIndex);
      onProgress?.({
        phase: 'mapping',
        step: 'vod',
        processedCount: Math.min(i + slice.length, vod.length),
        totalCount: vod.length,
      });
    }
  } else {
    vodError = results.vod.message;
  }

  if (results.series.ok) {
    seriesAvailable = true;
    const series = results.series.data;
    for (let i = 0; i < series.length; i += ARRAY_APPEND_BATCH) {
      const slice = series.slice(i, i + ARRAY_APPEND_BATCH);
      sortIndex += appendXtreamSeriesCatalog(channels, slice, sourceId, categoryNameById, sortIndex);
      onProgress?.({
        phase: 'mapping',
        step: 'series',
        processedCount: Math.min(i + slice.length, series.length),
        totalCount: series.length,
      });
    }
  } else {
    seriesError = results.series.message;
  }

  return { channels, vodAvailable, seriesAvailable, vodError, seriesError };
}
