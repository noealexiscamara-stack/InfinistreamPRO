export type SourceType = 'm3u_url' | 'm3u_file' | 'xtream' | 'direct_stream';

interface SourceBase {
  id: string;
  type: SourceType;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastRefreshedAt?: string;
  /** Number of channels discovered on the last successful refresh. */
  channelCount?: number;
  /** Set when the last refresh/connection attempt failed. */
  lastError?: string;
}

export interface M3uUrlSource extends SourceBase {
  type: 'm3u_url';
  url: string;
}

export interface M3uFileSource extends SourceBase {
  type: 'm3u_file';
  /** Local file URI the playlist was imported from. */
  fileUri: string;
}

export interface XtreamSource extends SourceBase {
  type: 'xtream';
  serverUrl: string;
  username: string;
  /**
   * Password is stored encrypted at rest (see utils/secureStorage).
   * Never logged, never synced to the backend in clear text.
   */
  password: string;
}

export interface DirectStreamSource extends SourceBase {
  type: 'direct_stream';
  url: string;
}

export type Source = M3uUrlSource | M3uFileSource | XtreamSource | DirectStreamSource;
