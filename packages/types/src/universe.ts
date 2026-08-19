/** Content universe derived from playlist metadata — no server taxonomy. */
export type ContentKind = 'live' | 'movie' | 'series' | 'radio';

/** @deprecated Use ContentKind — kept for backward compatibility. */
export type ChannelKind = ContentKind;

export interface ClassifiableEntry {
  name: string;
  streamUrl: string;
  groupTitle?: string;
  category?: string;
  tvgId?: string;
}

/** A series row in the catalogue (M3U grouping or Xtream listing). */
export interface SeriesItem {
  id: string;
  sourceId: string;
  title: string;
  logoUrl?: string;
  plot?: string;
  genre?: string;
  rating?: number;
  releaseDate?: string;
  sortIndex: number;
  /** Set for Xtream sources — episodes loaded on demand via getSeriesInfo. */
  xtreamSeriesId?: number;
  seasons?: SeriesSeason[];
}

export interface SeriesEpisode {
  id: string;
  sourceId: string;
  name: string;
  streamUrl: string;
  season: number;
  episode: number;
  title?: string;
  plot?: string;
  durationSeconds?: number;
  containerExtension?: string;
  logoUrl?: string;
  sortIndex: number;
}

export interface SeriesSeason {
  season: number;
  episodes: import('./channel').Channel[];
}

export interface GroupedSeries {
  id: string;
  sourceId: string;
  title: string;
  logoUrl?: string;
  sortIndex: number;
  seasons: SeriesSeason[];
}

export interface GroupEpisodesResult {
  series: GroupedSeries[];
  /** Series-kind entries we could not parse into a season/episode — still shown to the user. */
  unparsed: import('./channel').Channel[];
}
