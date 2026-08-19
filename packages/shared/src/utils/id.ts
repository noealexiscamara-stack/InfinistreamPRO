/**
 * Deterministic, dependency-free hashing for stable local ids.
 *
 * A channel's id is hash(sourceId + streamUrl), so re-importing or
 * refreshing a playlist keeps favorites and history attached to the same
 * channels rather than orphaning them.
 */

/**
 * FNV-1a, widened to 64 bits by running two independent lanes with
 * different offset bases and concatenating them.
 *
 * A single 32-bit lane is only ~4.29 billion values, which sounds like a
 * lot until the birthday paradox is applied: at roughly 77,000 items the
 * chance of *some* pair colliding passes 50%. IPTV aggregate playlists
 * routinely carry tens of thousands of entries, and measured on synthetic
 * URLs the old 32-bit id started colliding at around 20,000 channels. A
 * collision there is not cosmetic — two different channels claim the same
 * primary key and the import dies on a UNIQUE constraint.
 */
export function stableHash(input: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    a ^= c;
    a = Math.imul(a, 0x01000193);
    b ^= c + i;
    b = Math.imul(b, 0x85ebca6b);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

/**
 * Stable id for a channel.
 *
 * Deliberately derived from the stream URL and nothing else: the URL is
 * what identifies a stream, so the same channel keeps its id across
 * refreshes even when the provider renames it or moves it to another
 * category. The consequence is that two playlist entries sharing a URL are
 * the same channel by definition — see `dedupeChannelsByUrl`, which must
 * run before persisting.
 */
export function channelId(sourceId: string, streamUrl: string): string {
  return `ch_${stableHash(`${sourceId}::${streamUrl}`)}`;
}

export function sourceId(): string {
  return `src_${Date.now().toString(36)}${stableHash(Math.random().toString())}`;
}
