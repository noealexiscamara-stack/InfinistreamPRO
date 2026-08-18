import type { ChannelQualityTier, GroupedChannel } from '@infiny-stream/types';
import { nominalKbpsFor, selectStartingTier } from '../channels/groupChannels';

export type TierChangeReason =
  | 'initial'
  | 'single_tier'
  | 'mode_cap'
  | 'stall_downgrade'
  | 'throughput_downgrade'
  | 'failover_same_rank'
  | 'upgrade'
  | 'no_change';

export interface TierDecision {
  tier: ChannelQualityTier;
  changed: boolean;
  reason: TierChangeReason;
}

export interface ChannelTierSwitcherConfig {
  /** Minimum time on a tier before any automatic switch. */
  minDwellMs: number;
  /** Stalls needed inside `stallWindowMs` before dropping a tier. */
  stallsBeforeDowngrade: number;
  stallWindowMs: number;
  /** Throughput must exceed nominal-need * this factor to consider climbing. */
  upgradeThroughputMargin: number;
  /** ...and must hold that continuously for this long. */
  upgradeStableWindowMs: number;
  /** Extra stable time demanded per previous demotion from a tier, to stop ping-pong. */
  demotionPenaltyMs: number;
  /** Ceiling on the accumulated penalty, so a tier never becomes permanently unreachable. */
  maxDemotionPenaltyMs: number;
  /** Resolution cap from the user's quality mode. undefined = uncapped. */
  maxHeightLabel?: number;
}

/**
 * Defaults are tuned for an intermittent mobile connection, not a good one.
 *
 * The asymmetry is the whole point: dropping a tier is cheap to get wrong
 * (slightly softer picture), climbing is expensive to get wrong (a stall,
 * then a second reconnect on the way back down). So downgrades are quick
 * and upgrades are slow and have to prove themselves.
 */
export const DEFAULT_TIER_SWITCH_CONFIG: ChannelTierSwitcherConfig = {
  minDwellMs: 20_000,
  stallsBeforeDowngrade: 2,
  stallWindowMs: 30_000,
  upgradeThroughputMargin: 1.6,
  upgradeStableWindowMs: 90_000,
  demotionPenaltyMs: 60_000,
  maxDemotionPenaltyMs: 300_000,
};

/**
 * Coarse-grained adaptation *between playlist entries* of the same channel.
 *
 * This is the outer of two loops. The inner loop is
 * `AdaptiveStreamingManager`, which switches between renditions inside one
 * HLS stream — cheap, seamless, runs every few seconds. This outer loop
 * switches to a different URL entirely, which means tearing down the
 * connection and rebuffering: the user sees a black frame for a second or
 * two. It therefore runs on a much longer leash.
 *
 * Use it when `group.hasLadder` is true. When a channel has a single tier
 * there is nothing to decide and every call is a pass-through.
 */
export class ChannelTierSwitcher {
  private readonly config: ChannelTierSwitcherConfig;
  private group: GroupedChannel;
  private currentTierIndex = 0;
  private lastSwitchAt = -Infinity;
  private stallTimestamps: number[] = [];
  private throughputKbps: number | undefined;
  private upgradeCandidateSince: number | null = null;
  private upgradeCandidateRank: number | null = null;
  /** How many times we've been forced down off a given rank this session. */
  private readonly demotionsByRank = new Map<number, number>();
  /** Same-rank URLs already tried and found dead, so failover doesn't loop. */
  private readonly deadUrls = new Set<string>();

  constructor(group: GroupedChannel, config: Partial<ChannelTierSwitcherConfig> = {}) {
    this.config = { ...DEFAULT_TIER_SWITCH_CONFIG, ...config };
    this.group = group;
    this.currentTierIndex = this.indexOf(
      selectStartingTier(group, undefined, this.config.maxHeightLabel),
    );
  }

  /** Re-target at a new channel, keeping the learned network picture. */
  setGroup(group: GroupedChannel, estimatedThroughputKbps?: number): void {
    this.group = group;
    this.deadUrls.clear();
    this.stallTimestamps = [];
    this.upgradeCandidateSince = null;
    this.upgradeCandidateRank = null;
    this.lastSwitchAt = -Infinity;
    const throughput = estimatedThroughputKbps ?? this.throughputKbps;
    this.currentTierIndex = this.indexOf(selectStartingTier(group, throughput, this.config.maxHeightLabel));
  }

  setMaxHeightLabel(maxHeightLabel: number | undefined): void {
    this.config.maxHeightLabel = maxHeightLabel;
  }

  currentTier(): ChannelQualityTier {
    return this.group.tiers[this.currentTierIndex] ?? this.group.tiers[0];
  }

  reportThroughput(kbps: number): void {
    this.throughputKbps = kbps;
  }

  reportStall(nowMs: number): void {
    this.stallTimestamps.push(nowMs);
    this.pruneStalls(nowMs);
    // A stall invalidates any upgrade the current window was building toward.
    this.upgradeCandidateSince = null;
    this.upgradeCandidateRank = null;
  }

  /** Report that the current URL is unplayable (404/timeout/codec), not merely slow. */
  reportTierDead(nowMs: number): TierDecision {
    this.deadUrls.add(this.currentTier().channel.streamUrl);

    const alternate = this.allowedTiers().find(
      (t) => t.rank === this.currentTier().rank && !this.deadUrls.has(t.channel.streamUrl),
    );
    if (alternate) {
      this.currentTierIndex = this.indexOf(alternate);
      this.lastSwitchAt = nowMs;
      return { tier: alternate, changed: true, reason: 'failover_same_rank' };
    }

    const lower = [...this.allowedTiers()]
      .reverse()
      .find((t) => t.rank < this.currentTier().rank && !this.deadUrls.has(t.channel.streamUrl));
    if (lower) {
      this.noteDemotion(this.currentTier().rank);
      this.currentTierIndex = this.indexOf(lower);
      this.lastSwitchAt = nowMs;
      return { tier: lower, changed: true, reason: 'stall_downgrade' };
    }

    return { tier: this.currentTier(), changed: false, reason: 'no_change' };
  }

  /**
   * Re-evaluates the tier. Cheap and safe to call on a timer (every few
   * seconds); it only returns `changed: true` when a switch is genuinely
   * warranted, because acting on it costs the user a rebuffer.
   */
  decide(nowMs: number): TierDecision {
    const tiers = this.allowedTiers();

    if (this.group.tiers.length <= 1) {
      return { tier: this.currentTier(), changed: false, reason: 'single_tier' };
    }

    // A stricter user-selected cap wins immediately — it's an explicit
    // choice, not a network guess, so it skips the dwell timer.
    const current = this.currentTier();
    if (!tiers.some((t) => t.channel.streamUrl === current.channel.streamUrl)) {
      const target = tiers[tiers.length - 1];
      this.currentTierIndex = this.indexOf(target);
      this.lastSwitchAt = nowMs;
      return { tier: target, changed: true, reason: 'mode_cap' };
    }

    this.pruneStalls(nowMs);
    // `lastSwitchAt` starts at -Infinity, so the FIRST correction after
    // tuning in is allowed immediately. That's deliberate: the opening tier
    // is only a guess, and making the user sit through 20s of stalling to
    // "respect" a cooldown that is really there to stop oscillation between
    // switches would be exactly backwards. Every subsequent switch waits.
    const dwellElapsed = nowMs - this.lastSwitchAt >= this.config.minDwellMs;

    // --- Downgrade on repeated stalls -------------------------------------
    if (this.stallTimestamps.length >= this.config.stallsBeforeDowngrade && dwellElapsed) {
      const lower = [...tiers].reverse().find((t) => t.rank < current.rank && !this.deadUrls.has(t.channel.streamUrl));
      if (lower) {
        this.noteDemotion(current.rank);
        this.currentTierIndex = this.indexOf(lower);
        this.lastSwitchAt = nowMs;
        this.stallTimestamps = [];
        return { tier: lower, changed: true, reason: 'stall_downgrade' };
      }
      // Already at the bottom — clear the counter so we don't re-evaluate
      // this same burst forever.
      this.stallTimestamps = [];
    }

    // --- Downgrade on sustained insufficient throughput --------------------
    if (this.throughputKbps !== undefined && dwellElapsed && current.nominalHeight > 0) {
      const needed = nominalKbpsFor(current.nominalHeight);
      if (this.throughputKbps < needed * 0.8) {
        const affordable = [...tiers]
          .reverse()
          .find(
            (t) =>
              t.rank < current.rank &&
              !this.deadUrls.has(t.channel.streamUrl) &&
              (t.nominalHeight === 0 || this.throughputKbps! >= nominalKbpsFor(t.nominalHeight) * 0.9),
          );
        const fallback = [...tiers].reverse().find((t) => t.rank < current.rank && !this.deadUrls.has(t.channel.streamUrl));
        const target = affordable ?? fallback;
        if (target) {
          this.noteDemotion(current.rank);
          this.currentTierIndex = this.indexOf(target);
          this.lastSwitchAt = nowMs;
          return { tier: target, changed: true, reason: 'throughput_downgrade' };
        }
      }
    }

    // --- Upgrade, reluctantly ---------------------------------------------
    const currentIndex = tiers.findIndex((t) => t.channel.streamUrl === current.channel.streamUrl);
    const next = currentIndex >= 0 && currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : undefined;

    if (next && this.throughputKbps !== undefined && this.stallTimestamps.length === 0) {
      const needed = nominalKbpsFor(next.nominalHeight || current.nominalHeight || 480);
      const comfortable = this.throughputKbps >= needed * this.config.upgradeThroughputMargin;

      if (comfortable) {
        if (this.upgradeCandidateRank !== next.rank) {
          this.upgradeCandidateRank = next.rank;
          this.upgradeCandidateSince = nowMs;
        } else if (this.upgradeCandidateSince !== null) {
          const penalty = Math.min(
            (this.demotionsByRank.get(next.rank) ?? 0) * this.config.demotionPenaltyMs,
            this.config.maxDemotionPenaltyMs,
          );
          const required = this.config.upgradeStableWindowMs + penalty;
          if (nowMs - this.upgradeCandidateSince >= required && dwellElapsed) {
            this.currentTierIndex = this.indexOf(next);
            this.lastSwitchAt = nowMs;
            this.upgradeCandidateSince = null;
            this.upgradeCandidateRank = null;
            return { tier: next, changed: true, reason: 'upgrade' };
          }
        }
      } else {
        this.upgradeCandidateSince = null;
        this.upgradeCandidateRank = null;
      }
    }

    return { tier: current, changed: false, reason: 'no_change' };
  }

  private allowedTiers(): ChannelQualityTier[] {
    const cap = this.config.maxHeightLabel;
    if (cap === undefined) return this.group.tiers;
    const capped = this.group.tiers.filter((t) => t.nominalHeight === 0 || t.nominalHeight <= cap);
    return capped.length > 0 ? capped : [this.group.tiers[0]];
  }

  private indexOf(tier: ChannelQualityTier): number {
    const index = this.group.tiers.findIndex((t) => t.channel.streamUrl === tier.channel.streamUrl);
    return index >= 0 ? index : 0;
  }

  private noteDemotion(rank: number): void {
    this.demotionsByRank.set(rank, (this.demotionsByRank.get(rank) ?? 0) + 1);
  }

  private pruneStalls(nowMs: number): void {
    const cutoff = nowMs - this.config.stallWindowMs;
    this.stallTimestamps = this.stallTimestamps.filter((t) => t >= cutoff);
  }
}
