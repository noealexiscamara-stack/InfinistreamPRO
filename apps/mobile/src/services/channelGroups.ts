import { groupChannelsByQuality } from '@infiny-stream/shared';
import type { Channel, GroupedChannel } from '@infiny-stream/types';

export function groupedFromChannels(channels: Channel[]): GroupedChannel[] {
  return groupChannelsByQuality(channels).groups;
}

export function findGroupContaining(groups: GroupedChannel[], channelId: string): GroupedChannel | undefined {
  return groups.find((group) => group.tiers.some((tier) => tier.channel.id === channelId));
}

export function groupHasFavorite(group: GroupedChannel, isFavorite: (channelId: string) => boolean): boolean {
  return group.tiers.some((tier) => isFavorite(tier.channel.id));
}

export function groupFavoriteChannel(group: GroupedChannel): Channel {
  return group.tiers[0].channel;
}

/** Compact ladder badge, e.g. "SD/HD/FHD". Empty when there is no real choice. */
export function ladderBadge(group: GroupedChannel): string | null {
  if (!group.hasLadder) return null;
  const labels = group.tiers.map((tier) => tier.label).filter((label) => label.length > 0);
  const unique = [...new Set(labels)];
  return unique.length > 0 ? unique.join('/') : null;
}
