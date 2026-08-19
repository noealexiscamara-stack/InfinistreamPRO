/**
 * A single playable channel/stream, however it was discovered
 * (M3U entry, Xtream Codes API, or a raw direct link).
 */
export interface Channel {
  /** Stable local id: hash of (sourceId + streamUrl). Not a server id. */
  id: string;
  sourceId: string;
  name: string;
  streamUrl: string;
  logoUrl?: string;
  groupTitle?: string;
  tvgId?: string;
  tvgName?: string;
  country?: string;
  category?: string;
  /** Order the channel appeared in its source, for stable list rendering. */
  sortIndex: number;
  /** live | movie | series | radio — inferred at import from playlist metadata. */
  kind?: import('./universe').ContentKind;
  plot?: string;
  genre?: string;
  rating?: number;
  releaseDate?: string;
  containerExtension?: string;
  xtreamStreamId?: number;
  xtreamSeriesId?: number;
  xtreamEpisodeId?: string;
}

export interface ChannelCategory {
  id: string;
  sourceId: string;
  name: string;
  channelCount: number;
}

/**
 * One rung of a channel's quality ladder, recovered from the provider's own
 * naming convention ("TF1 SD" / "TF1 HD" / "TF1 FHD" shipped as three
 * unrelated M3U entries).
 */
export interface ChannelQualityTier {
  /** The original playlist entry — this is what actually gets played. */
  channel: Channel;
  /** Canonical marker read from the name: 'SD' | 'HD' | 'FHD' | 'QHD' | 'UHD' | '8K', or '' when unmarked. */
  label: string;
  /** Ordinal position in the ladder. 0 = the entry carried no quality marker. */
  rank: number;
  /**
   * Vertical resolution the marker conventionally implies. A reading of the
   * provider's label, NOT a measurement of the stream — never show it to the
   * user as the stream's verified resolution.
   */
  nominalHeight: number;
}

/**
 * A logical channel: one entry in the user-facing list, backed by one or
 * more playlist entries at different quality tiers.
 */
export interface GroupedChannel {
  id: string;
  sourceId: string;
  /** Base name with the quality marker removed, e.g. 'TF1'. */
  name: string;
  logoUrl?: string;
  groupTitle?: string;
  tvgId?: string;
  /** Position of the earliest-appearing tier, so list order stays stable. */
  sortIndex: number;
  /** Ascending: lowest quality first. Always at least one entry. */
  tiers: ChannelQualityTier[];
  /** True when there is a real choice to adapt between (more than one distinct rank). */
  hasLadder: boolean;
}
