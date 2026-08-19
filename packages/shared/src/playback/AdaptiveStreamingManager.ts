import type { NetworkSample, NetworkState, QualityMode, StreamVariant } from '@infiny-stream/types';
import { ThroughputEstimator, type ThroughputEstimatorConfig } from '../network/estimator';
import { classifyNetworkQuality } from '../network/quality';
import { QUALITY_MODE_PROFILES } from './qualityModeProfiles';

export type QualityChangeReason =
  | 'initial'
  | 'single_variant'
  | 'mode_cap'
  | 'downgrade_network'
  | 'downgrade_stall'
  | 'upgrade_network'
  | 'no_change';

export interface QualityDecision {
  variant: StreamVariant;
  changed: boolean;
  reason: QualityChangeReason;
}

export interface AdaptiveStreamingManagerConfig extends Partial<ThroughputEstimatorConfig> {
  /** Minimum time between two automatic switches, to prevent oscillation (720p<->480p flapping). */
  minSwitchIntervalMs: number;
}

const DEFAULT_MIN_SWITCH_INTERVAL_MS = 8_000;

/**
 * Decides which stream rendition to play, given real observed throughput
 * and the user's chosen quality mode. This module never invents a quality
 * the source doesn't provide (see setVariants): if a stream only has a
 * single rendition, it is a pass-through. If it's an adaptive HLS ladder,
 * this picks the best sustainable step using a hysteresis window so a
 * momentary blip doesn't cause visible quality flapping.
 */
export class AdaptiveStreamingManager {
  private readonly estimator: ThroughputEstimator;
  private readonly minSwitchIntervalMs: number;

  private variants: StreamVariant[] = [];
  private mode: QualityMode = 'auto';
  private currentVariantId: string | null = null;
  private lastSwitchAt = -Infinity;
  private unsafeStreak = 0;
  private upgradeCandidateId: string | null = null;
  private upgradeCandidateSince: number | null = null;

  constructor(config: Partial<AdaptiveStreamingManagerConfig> = {}) {
    const { minSwitchIntervalMs, ...estimatorConfig } = config;
    this.estimator = new ThroughputEstimator(estimatorConfig);
    this.minSwitchIntervalMs = minSwitchIntervalMs ?? DEFAULT_MIN_SWITCH_INTERVAL_MS;
  }

  /** Called once a stream's available renditions are known (e.g. HLS master playlist parsed, or a single direct URL). */
  setVariants(variants: StreamVariant[], preferredStartId?: string): void {
    this.variants = [...variants].sort((a, b) => a.bitrateKbps - b.bitrateKbps);
    this.unsafeStreak = 0;
    this.upgradeCandidateId = null;
    this.upgradeCandidateSince = null;
    this.lastSwitchAt = -Infinity;

    if (this.variants.length === 0) {
      this.currentVariantId = null;
      return;
    }

    const preferred = preferredStartId && this.variants.find((v) => v.id === preferredStartId);
    // Conservative start: begin at the lowest-but-one rendition (or lowest,
    // for a 2-step ladder) rather than guessing high, so first playback
    // doesn't stall while the network is still being measured.
    const startIndex = this.variants.length > 2 ? 1 : 0;
    this.currentVariantId = preferred ? preferred.id : this.variants[startIndex].id;
  }

  setMode(mode: QualityMode): void {
    this.mode = mode;
  }

  getMode(): QualityMode {
    return this.mode;
  }

  reportSample(sample: NetworkSample): void {
    this.estimator.addSample(sample);
  }

  /** Convenience for a rebuffer/stall event: treated as ground truth that the current estimate was too optimistic. */
  reportStall(observedKbps: number, atMs: number): void {
    this.estimator.addSample({
      timestampMs: atMs,
      throughputKbps: observedKbps,
      connectionType: 'unknown',
      fromStall: true,
    });
    this.unsafeStreak = Math.max(this.unsafeStreak, QUALITY_MODE_PROFILES[this.mode].downgradeConsecutiveSamples);
  }

  getNetworkState(nowMs: number): NetworkState {
    const throughput = this.estimator.estimatedKbps;
    const stable = this.estimator.isStable;
    return {
      quality: classifyNetworkQuality(throughput, stable),
      connectionType: 'unknown',
      estimatedThroughputKbps: throughput,
      isStable: stable,
      lastUpdated: nowMs,
    };
  }

  private allowedLadder(): StreamVariant[] {
    const cap = QUALITY_MODE_PROFILES[this.mode].maxHeightLabel;
    if (!cap) return this.variants;
    const capped = this.variants.filter((v) => v.heightLabel <= cap);
    // Never leave the ladder empty because every variant exceeds the cap —
    // fall back to the single lowest available rendition.
    return capped.length > 0 ? capped : [this.variants[0]];
  }

  private currentVariant(): StreamVariant | undefined {
    return this.variants.find((v) => v.id === this.currentVariantId);
  }

  /**
   * Re-evaluates the target rendition given everything observed so far.
   * Call this periodically (e.g. every few seconds, or after a stall) —
   * it is cheap and side-effect-free besides internal hysteresis bookkeeping.
   */
  decide(nowMs: number, forceImmediate = false): QualityDecision | null {
    if (this.variants.length === 0) {
      return null;
    }

    if (this.variants.length === 1) {
      const only = this.variants[0];
      const changed = this.currentVariantId !== only.id;
      this.currentVariantId = only.id;
      return { variant: only, changed, reason: 'single_variant' };
    }

    const ladder = this.allowedLadder();
    let current = this.currentVariant();

    // Mode was changed to a stricter cap (e.g. switched to Économie while
    // at 1080p) — clamp down immediately, this is a deliberate user choice,
    // not network flapping, so it bypasses the cooldown.
    const cap = QUALITY_MODE_PROFILES[this.mode].maxHeightLabel;
    if (current && cap && current.heightLabel > cap) {
      const target = ladder[ladder.length - 1];
      this.currentVariantId = target.id;
      this.lastSwitchAt = nowMs;
      this.unsafeStreak = 0;
      this.resetUpgradeCandidate();
      return { variant: target, changed: target.id !== current.id, reason: 'mode_cap' };
    }

    if (!current) {
      current = ladder[0];
      this.currentVariantId = current.id;
      return { variant: current, changed: true, reason: 'initial' };
    }

    const profile = QUALITY_MODE_PROFILES[this.mode];
    const throughput = this.estimator.estimatedKbps;
    const stable = this.estimator.isStable;

    const isUnsafe = throughput < current.bitrateKbps * profile.downgradeThresholdRatio;
    this.unsafeStreak = isUnsafe ? this.unsafeStreak + 1 : 0;

    const cooldownElapsed = nowMs - this.lastSwitchAt >= this.minSwitchIntervalMs;
    const shouldDowngrade =
      isUnsafe && this.unsafeStreak >= profile.downgradeConsecutiveSamples && (cooldownElapsed || forceImmediate);

    if (shouldDowngrade) {
      const safeCeilingKbps = throughput * profile.downgradeSelectMargin;
      const candidates = ladder.filter((v) => v.bitrateKbps <= safeCeilingKbps && v.bitrateKbps < current!.bitrateKbps);
      const target = candidates.length > 0 ? candidates[candidates.length - 1] : ladder[0];

      if (target.id !== current.id) {
        this.currentVariantId = target.id;
        this.lastSwitchAt = nowMs;
        this.unsafeStreak = 0;
        this.resetUpgradeCandidate();
        return { variant: target, changed: true, reason: forceImmediate ? 'downgrade_stall' : 'downgrade_network' };
      }
    }

    // Upgrade path: only considered when the current rendition is safe.
    if (!isUnsafe) {
      const currentIndex = ladder.findIndex((v) => v.id === current!.id);
      const candidate = currentIndex >= 0 && currentIndex < ladder.length - 1 ? ladder[currentIndex + 1] : undefined;

      if (candidate) {
        const worthTrying = stable && throughput > candidate.bitrateKbps * profile.upgradeThresholdRatio;

        if (worthTrying) {
          if (this.upgradeCandidateId !== candidate.id) {
            this.upgradeCandidateId = candidate.id;
            this.upgradeCandidateSince = nowMs;
          } else if (
            this.upgradeCandidateSince !== null &&
            nowMs - this.upgradeCandidateSince >= profile.upgradeStableWindowMs &&
            cooldownElapsed
          ) {
            this.currentVariantId = candidate.id;
            this.lastSwitchAt = nowMs;
            this.resetUpgradeCandidate();
            return { variant: candidate, changed: true, reason: 'upgrade_network' };
          }
        } else {
          this.resetUpgradeCandidate();
        }
      } else {
        this.resetUpgradeCandidate();
      }
    }

    return { variant: current, changed: false, reason: 'no_change' };
  }

  private resetUpgradeCandidate(): void {
    this.upgradeCandidateId = null;
    this.upgradeCandidateSince = null;
  }
}
