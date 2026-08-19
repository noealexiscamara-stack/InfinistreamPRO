import type {
  XtreamClient,
  XtreamLiveStream,
  XtreamResult,
  XtreamSeries,
  XtreamSeriesInfo,
  XtreamVodStream,
} from '@infiny-stream/shared';
import type { ContentKind } from '@infiny-stream/types';

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
  live: XtreamResult<XtreamLiveStream[]>;
  vod: XtreamResult<XtreamVodStream[]>;
  series: XtreamResult<XtreamSeries[]>;
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

export function mapXtreamLiveStreams(
  streams: XtreamLiveStream[],
  client: Pick<XtreamClient, 'buildLiveStreamUrl'>,
  categoryNameById: Map<string, string>,
  sortIndexStart = 0
): PersistableChannel[] {
  return streams.map((stream, index) => {
    const category = categoryNameById.get(stream.categoryId);
    return {
      name: stream.name,
      streamUrl: client.buildLiveStreamUrl(stream.streamId),
      logoUrl: stream.streamIcon,
      groupTitle: category,
      category,
      tvgId: stream.epgChannelId,
      sortIndex: sortIndexStart + index,
      kind: 'live' as const,
    };
  });
}

export function mapXtreamVodStreams(
  streams: XtreamVodStream[],
  client: Pick<XtreamClient, 'buildVodStreamUrl'>,
  categoryNameById: Map<string, string>,
  sortIndexStart = 0
): PersistableChannel[] {
  return streams.map((vod, index) => {
    const category = categoryNameById.get(vod.categoryId);
    return {
      name: vod.name,
      streamUrl: client.buildVodStreamUrl(vod.streamId, vod.containerExtension),
      logoUrl: vod.icon,
      groupTitle: category,
      category,
      sortIndex: sortIndexStart + index,
      kind: 'movie' as const,
      rating: vod.rating,
      releaseDate: vod.added,
      containerExtension: vod.containerExtension,
      xtreamStreamId: vod.streamId,
    };
  });
}

export function mapXtreamSeriesCatalog(
  seriesList: XtreamSeries[],
  sourceId: string,
  categoryNameById: Map<string, string>,
  sortIndexStart = 0
): PersistableChannel[] {
  return seriesList.map((series, index) => {
    const category = categoryNameById.get(series.categoryId);
    return {
      name: series.name,
      streamUrl: xtreamSeriesPlaceholderUrl(sourceId, series.seriesId),
      logoUrl: series.cover,
      groupTitle: category,
      category,
      sortIndex: sortIndexStart + index,
      kind: 'series' as const,
      plot: series.plot,
      genre: series.genre,
      rating: series.rating,
      releaseDate: series.releaseDate,
      xtreamSeriesId: series.seriesId,
    };
  });
}

export function mapXtreamSeriesEpisodes(
  source: { id: string },
  seriesId: number,
  seriesTitle: string,
  info: XtreamSeriesInfo,
  client: Pick<XtreamClient, 'buildEpisodeStreamUrl'>
): PersistableChannel[] {
  return info.episodes.map((ep, index) => ({
    name: ep.title
      ? `${seriesTitle} S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')} — ${ep.title}`
      : `${seriesTitle} S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`,
    streamUrl: client.buildEpisodeStreamUrl(ep.episodeId, ep.containerExtension),
    groupTitle: seriesTitle,
    category: seriesTitle,
    sortIndex: index,
    kind: 'series' as const,
    plot: ep.plot,
    containerExtension: ep.containerExtension,
    xtreamEpisodeId: ep.episodeId,
    xtreamSeriesId: seriesId,
  }));
}

/**
 * Builds the full channel list for an Xtream import. Live failure aborts;
 * VOD/series failures are tolerated so a provider without films does not
 * block live TV import.
 */
export function buildXtreamChannelsFromFetch(
  sourceId: string,
  client: StreamUrlBuilder,
  categoryNameById: Map<string, string>,
  results: XtreamCatalogFetchResults
): BuildXtreamChannelsResult {
  if (!results.live.ok) {
    throw new Error(results.live.message);
  }

  const channels: PersistableChannel[] = mapXtreamLiveStreams(results.live.data, client, categoryNameById);
  let sortIndex = channels.length;

  let vodAvailable = false;
  let seriesAvailable = false;
  let vodError: string | undefined;
  let seriesError: string | undefined;

  if (results.vod.ok) {
    vodAvailable = true;
    const movies = mapXtreamVodStreams(results.vod.data, client, categoryNameById, sortIndex);
    channels.push(...movies);
    sortIndex += movies.length;
  } else {
    vodError = results.vod.message;
  }

  if (results.series.ok) {
    seriesAvailable = true;
    const series = mapXtreamSeriesCatalog(results.series.data, sourceId, categoryNameById, sortIndex);
    channels.push(...series);
  } else {
    seriesError = results.series.message;
  }

  return { channels, vodAvailable, seriesAvailable, vodError, seriesError };
}
