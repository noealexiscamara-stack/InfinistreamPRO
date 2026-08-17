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
}

export interface ChannelCategory {
  id: string;
  sourceId: string;
  name: string;
  channelCount: number;
}
