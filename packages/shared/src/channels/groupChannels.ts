import type { Channel, ChannelQualityTier, GroupedChannel } from '@infiny-stream/types';
import { channelNameKey, stripQualityMarker } from './qualityMarkers';
import { stableHash } from '../utils/id';

export interface GroupChannelsResult {
  groups: GroupedChannel[];
  /** Entries dropped because an identical streamUrl already appeared in the same group. */
  duplicatesRemoved: number;
  /** How many groups ended up with a usable ladder (more than one distinct quality). */
  laddersFound: number;
}

/**
 * Rebuilds per-channel quality ladders from a flat playlist.
 *
 * IPTV providers ship "TF1 SD", "TF1 HD" and "TF1 FHD" as three unrelated
 * M3U entries; a naive player shows them as three channels and can never
 * adapt between them. Grouping them back together is what lets the player
 * drop to a lighter rendition on a weak connection instead of just
 * buffering — on sources that never advertised an adaptive ladder at all.
 *
 * Invariants, in priority order:
 *
 *  - **Nothing is lost.** Every input channel appears in exactly one group,
 *    except exact duplicates (same streamUrl within the same group), which
 *    are counted in `duplicatesRemoved`. A channel silently vanishing from
 *    the list is the worst possible failure here.
 *  - **Nothing is invented.** The ladder only ever contains entries the
 *    playlist actually provided. If a channel exists solely in 1080p, the
 *    group has exactly one tier and `hasLadder` is false.
 *  - **When in doubt, don't merge.** Distinct tvg-ids split a group even
 *    when the names match (regional feeds), and near-miss names are never
 *    fuzzy-matched.
 *
 * Two entries landing on the *same* rank are both kept: providers often
 * list the same quality on several servers, and having a second URL at the
 * same tier is a genuine resilience win when one origin goes down.
 */
export function groupChannelsByQuality(channels: Channel[]): GroupChannelsResult {
  // Pass 1 — bucket by normalised base name.
  const byName = new Map<string, Array<{ channel: Channel; tier: Omit<ChannelQualityTier, 'channel'>; baseName: string }>>();

  for (const channel of channels) {
    const { baseName, marker } = stripQualityMarker(channel.name);
    const key = channelNameKey(baseName);
    const entry = {
      channel,
      baseName,
      tier: { label: marker.label, rank: marker.rank, nominalHeight: marker.nominalHeight },
    };
    const bucket = byName.get(key);
    if (bucket) bucket.push(entry);
    else byName.set(key, [entry]);
  }

  const groups: GroupedChannel[] = [];
  let duplicatesRemoved = 0;

  for (const [nameKey, bucket] of byName) {
    // Pass 2 — split the bucket by tvg-id. Same name but a different EPG id
    // means a different feed (a national vs a regional variant), and merging
    // those would make one of them unreachable.
    const distinctTvgIds = new Set(bucket.map((e) => e.channel.tvgId).filter((id): id is string => !!id && id.length > 0));

    const subgroups = new Map<string, typeof bucket>();
    for (const entry of bucket) {
      const tvgId = entry.channel.tvgId ?? '';
      // An entry with no tvg-id joins the group's single known id when
      // there is exactly one — that's the common case of a provider
      // tagging only some of the quality variants. With zero or several
      // candidate ids there's nothing safe to attach it to, so it keys on
      // its own.
      const subKey = tvgId.length > 0 ? tvgId : distinctTvgIds.size === 1 ? [...distinctTvgIds][0] : '';
      const existing = subgroups.get(subKey);
      if (existing) existing.push(entry);
      else subgroups.set(subKey, [entry]);
    }

    for (const [subKey, entries] of subgroups) {
      const seenUrls = new Set<string>();
      const tiers: ChannelQualityTier[] = [];

      for (const entry of entries) {
        if (seenUrls.has(entry.channel.streamUrl)) {
          duplicatesRemoved++;
          continue;
        }
        seenUrls.add(entry.channel.streamUrl);
        tiers.push({ channel: entry.channel, ...entry.tier });
      }

      if (tiers.length === 0) continue;

      // Lowest quality first. Unmarked entries (rank 0) sort to the front:
      // we don't know what they are, and starting low is the safe default on
      // an unreliable connection. Ties keep playlist order.
      tiers.sort((a, b) => a.rank - b.rank || a.nominalHeight - b.nominalHeight || a.channel.sortIndex - b.channel.sortIndex);

      const first = tiers.reduce((min, t) => (t.channel.sortIndex < min.channel.sortIndex ? t : min), tiers[0]);
      const distinctRanks = new Set(tiers.map((t) => t.rank));

      groups.push({
        id: `grp_${stableHash(`${first.channel.sourceId}::${nameKey}::${subKey}`)}`,
        sourceId: first.channel.sourceId,
        // Prefer the base name of the earliest entry so casing matches what
        // the provider used at the top of its own list.
        name: stripQualityMarker(first.channel.name).baseName,
        logoUrl: tiers.find((t) => t.channel.logoUrl)?.channel.logoUrl,
        groupTitle: first.channel.groupTitle,
        tvgId: subKey.length > 0 ? subKey : undefined,
        sortIndex: first.channel.sortIndex,
        tiers,
        hasLadder: distinctRanks.size > 1,
      });
    }
  }

  groups.sort((a, b) => a.sortIndex - b.sortIndex);

  return {
    groups,
    duplicatesRemoved,
    laddersFound: groups.filter((g) => g.hasLadder).length,
  };
}

/**
 * Picks which tier to start on.
 *
 * Deliberately pessimistic: on an unstable connection the cost of starting
 * too high is a stall and a reconnect before the user has seen anything,
 * while the cost of starting too low is a few seconds of softer image
 * before the ladder climbs. The second is much cheaper, so when the network
 * state is unknown or poor this starts at the bottom.
 */
export function selectStartingTier(
  group: GroupedChannel,
  estimatedThroughputKbps: number | undefined,
  maxHeightLabel?: number,
): ChannelQualityTier {
  const allowed =
    maxHeightLabel === undefined
      ? group.tiers
      : (() => {
          const capped = group.tiers.filter((t) => t.nominalHeight === 0 || t.nominalHeight <= maxHeightLabel);
          return capped.length > 0 ? capped : [group.tiers[0]];
        })();

  if (allowed.length === 1 || estimatedThroughputKbps === undefined || estimatedThroughputKbps <= 0) {
    return allowed[0];
  }

  // Rough sustainable-height guide. These are priors about what a given
  // resolution typically needs, used only to avoid an obviously doomed
  // starting choice — they are never presented as the stream's real bitrate.
  const affordable = allowed.filter((t) => t.nominalHeight === 0 || estimatedThroughputKbps >= nominalKbpsFor(t.nominalHeight));

  if (affordable.length === 0) return allowed[0];

  // Start one rung below the best affordable tier when there is room, so the
  // first climb is an upgrade rather than an immediate stall-and-drop.
  const bestIndex = allowed.indexOf(affordable[affordable.length - 1]);
  return allowed[Math.max(0, bestIndex - 1)];
}

/** Typical sustained bitrate for a given vertical resolution, as a starting prior only. */
export function nominalKbpsFor(height: number): number {
  if (height >= 4320) return 30_000;
  if (height >= 2160) return 15_000;
  if (height >= 1440) return 8_000;
  if (height >= 1080) return 4_500;
  if (height >= 720) return 2_500;
  if (height >= 576) return 1_400;
  if (height >= 480) return 1_100;
  if (height >= 360) return 700;
  return 400;
}
