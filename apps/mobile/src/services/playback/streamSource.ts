import type { VideoSource } from 'expo-video';
import { IPTV_CLIENT_USER_AGENT } from '@infiny-stream/shared';

const STREAM_HEADERS = {
  'User-Agent': IPTV_CLIENT_USER_AGENT,
  Accept: '*/*',
} as const;

export function isLikelyHls(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

/** Mask Xtream user/pass in stream URLs for logs — never print credentials. */
export function maskStreamCredentials(url: string): string {
  return url.replace(/(\/(?:live|movie|series)\/)[^/]+\/[^/]+(\/)/gi, '$1***/***$2');
}

/**
 * Xtream VOD/series URLs must end with the provider container_extension.
 * Repairs mistaken live-style .m3u8/.ts suffixes on /movie/ or /series/ paths.
 */
export function ensureVodContainerExtension(url: string, containerExtension?: string | null): string {
  if (!containerExtension) return url;
  const ext = containerExtension.replace(/^\./, '');
  if (!ext) return url;
  if (!/\/(movie|series)\//i.test(url)) return url;
  if (new RegExp(`\\.${ext}(\\?|$)`, 'i').test(url)) return url;
  if (/\.(m3u8|ts)(\?|$)/i.test(url)) {
    return url.replace(/\.(m3u8|ts)(\?|$)/i, `.${ext}$2`);
  }
  // Bare id with no extension: …/123 → …/123.mkv
  if (/\/\d+(\?|$)/.test(url)) {
    return url.replace(/\/(\d+)(\?|$)/, `/$1.${ext}$2`);
  }
  return url;
}

/** Builds an expo-video source with IPTV headers providers expect on every segment request. */
export function buildStreamVideoSource(url: string): VideoSource {
  const base = {
    uri: url,
    headers: { ...STREAM_HEADERS },
  };
  return isLikelyHls(url) ? { ...base, contentType: 'hls' as const } : base;
}

/** Some Xtream hosts serve live only as MPEG-TS while others require HLS. Never use on VOD. */
export function alternateLiveStreamUrl(url: string): string | null {
  if (!/\/live\//i.test(url)) return null;
  if (/\.m3u8(\?.*)?$/i.test(url)) return url.replace(/\.m3u8(\?.*)?$/i, '.ts$1');
  if (/\.ts(\?.*)?$/i.test(url)) return url.replace(/\.ts(\?.*)?$/i, '.m3u8$1');
  return null;
}
