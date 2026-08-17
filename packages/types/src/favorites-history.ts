export interface FavoriteChannel {
  channelId: string;
  sourceId: string;
  addedAt: string;
}

export interface HistoryEntry {
  channelId: string;
  sourceId: string;
  channelName: string;
  logoUrl?: string;
  lastWatchedAt: string;
  /** Playback position in seconds, only meaningful for VOD/catch-up, not live channels. */
  positionSeconds?: number;
}
