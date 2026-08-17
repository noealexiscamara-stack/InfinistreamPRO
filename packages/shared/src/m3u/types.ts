import type { Channel, ChannelCategory } from '@infiny-stream/types';

export interface ParsedM3uChannel extends Omit<Channel, 'id' | 'sourceId'> {}

export interface ParsedPlaylist {
  channels: ParsedM3uChannel[];
  categories: Array<Pick<ChannelCategory, 'name' | 'channelCount'>>;
  /** x-tvg-url attribute from the #EXTM3U header, if the playlist references an EPG. */
  epgUrl?: string;
  warnings: string[];
}

export interface M3uParseOptions {
  /**
   * Number of #EXTINF entries to process before yielding control back to the
   * event loop. Keeps the UI thread responsive on playlists with thousands
   * of channels. Defaults to 500.
   */
  chunkSize?: number;
  onProgress?: (parsedCount: number) => void;
}
