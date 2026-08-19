/**
 * Removing the duplicate entries that real IPTV playlists are full of.
 *
 * This exists because of a bug seen in production, not as a precaution.
 * Aggregate playlists — iptv-org's `index.category.m3u` is the canonical
 * example — list every channel once *per category*, so a channel tagged
 * both "News" and "General" appears twice with an identical stream URL.
 * Since a channel's id is derived from its URL (see utils/id.ts), those
 * two rows carry the same primary key, and the import dies with
 * `UNIQUE constraint failed: channels.id` — leaving the user with a
 * playlist showing 0 channels and no idea why.
 *
 * Paid providers do it too, usually by listing the same stream on several
 * backup servers under slightly different names.
 */

export interface DedupeResult<T> {
  channels: T[];
  /** How many entries were dropped as duplicates, for honest reporting. */
  duplicatesRemoved: number;
}

/**
 * Keeps the first entry for each distinct stream URL.
 *
 * First rather than last on purpose: playlists are ordered, and the first
 * occurrence is the one whose category and name the provider considered
 * primary. The trade-off is that a channel listed under two categories
 * ends up filed under the first only — which is the honest consequence of
 * treating "same URL" as "same channel", and vastly preferable to an
 * import that fails outright.
 */
export function dedupeChannelsByUrl<T extends { streamUrl: string }>(channels: T[]): DedupeResult<T> {
  const seen = new Set<string>();
  const out: T[] = [];
  let duplicatesRemoved = 0;

  for (const channel of channels) {
    if (seen.has(channel.streamUrl)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(channel.streamUrl);
    out.push(channel);
  }

  return { channels: out, duplicatesRemoved };
}
