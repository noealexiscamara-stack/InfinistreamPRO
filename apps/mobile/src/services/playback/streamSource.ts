import type { VideoSource } from 'expo-video';
import { IPTV_CLIENT_USER_AGENT } from '@infiny-stream/shared';

const STREAM_HEADERS = {
  'User-Agent': IPTV_CLIENT_USER_AGENT,
  Accept: '*/*',
} as const;

export function isLikelyHls(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

/** Builds an expo-video source with IPTV headers providers expect on every segment request. */
export function buildStreamVideoSource(url: string): VideoSource {
  const base = {
    uri: url,
    headers: { ...STREAM_HEADERS },
  };
  return isLikelyHls(url) ? { ...base, contentType: 'hls' as const } : base;
}

/** Some Xtream hosts serve live only as MPEG-TS while others require HLS. */
export function alternateLiveStreamUrl(url: string): string | null {
  if (/\.m3u8(\?.*)?$/i.test(url)) return url.replace(/\.m3u8(\?.*)?$/i, '.ts$1');
  if (/\.ts(\?.*)?$/i.test(url)) return url.replace(/\.ts(\?.*)?$/i, '.m3u8$1');
  return null;
}
