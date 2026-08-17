import type { StreamVariant } from '@infiny-stream/types';

/**
 * Resolves a possibly-relative HLS URI against the master playlist's own
 * URL, the same way a player would.
 */
function resolveUri(uri: string, baseUrl: string): string {
  try {
    return new URL(uri, baseUrl).toString();
  } catch {
    return uri;
  }
}

/**
 * Parses an HLS master playlist's #EXT-X-STREAM-INF variants into our
 * StreamVariant shape. This exists so the app can:
 *  - display the real resolution ladder a channel offers (per product
 *    rule #23: never invent a quality the source doesn't provide), and
 *  - enforce a quality-mode cap (e.g. Économie/Équilibré) by pointing the
 *    player straight at one rendition's URI instead of the master
 *    playlist — a standard technique to constrain playback to a specific
 *    tier when the player's own ABR track-selection isn't exposed at the
 *    JS layer (see AdaptiveStreamingManager module docs).
 *
 * Returns an empty array when `content` is not a master playlist (e.g. it
 * is already a single-rendition media playlist, or a non-adaptive direct
 * stream) — callers should treat that as "single quality, no adaptation
 * possible", never fabricate a ladder.
 */
export function parseHlsMasterPlaylist(content: string, baseUrl: string): StreamVariant[] {
  if (!/#EXT-X-STREAM-INF/i.test(content)) {
    return [];
  }

  const lines = content.split(/\r\n|\r|\n/);
  const variants: StreamVariant[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!/^#EXT-X-STREAM-INF:/i.test(line)) continue;

    const attrsPart = line.slice(line.indexOf(':') + 1);
    const bandwidthMatch = attrsPart.match(/BANDWIDTH=(\d+)/i);
    const resolutionMatch = attrsPart.match(/RESOLUTION=\d+x(\d+)/i);

    // The URI is the next non-comment, non-empty line.
    let uriLine: string | undefined;
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j].trim();
      if (candidate.length === 0) continue;
      if (candidate.startsWith('#')) continue;
      uriLine = candidate;
      i = j;
      break;
    }

    if (!bandwidthMatch || !uriLine) continue;

    const bitrateKbps = Math.round(Number(bandwidthMatch[1]) / 1000);
    // RESOLUTION is optional per the HLS spec; fall back to a label derived
    // from bitrate so the variant still sorts/displays sensibly.
    const heightLabel = resolutionMatch ? Number(resolutionMatch[1]) : Math.round(bitrateKbps / 4);

    variants.push({
      id: `${heightLabel}p_${bitrateKbps}kbps`,
      heightLabel,
      bitrateKbps,
      url: resolveUri(uriLine, baseUrl),
    });
  }

  return variants.sort((a, b) => a.bitrateKbps - b.bitrateKbps);
}
