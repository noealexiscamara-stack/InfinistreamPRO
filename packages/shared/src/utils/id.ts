/**
 * Deterministic, dependency-free FNV-1a hash. Used to derive stable local
 * ids (channel id = hash(sourceId + streamUrl)) so re-importing/refreshing
 * a playlist doesn't orphan favorites/history tied to the old ids.
 */
export function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function channelId(sourceId: string, streamUrl: string): string {
  return `ch_${stableHash(`${sourceId}::${streamUrl}`)}`;
}

export function sourceId(): string {
  return `src_${Date.now().toString(36)}${stableHash(Math.random().toString())}`;
}
