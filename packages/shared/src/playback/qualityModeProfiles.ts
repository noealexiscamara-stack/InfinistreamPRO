import type { QualityMode } from '@infiny-stream/types';

export interface QualityModeProfile {
  /** Hard resolution ceiling in this mode, regardless of available bandwidth. undefined = no cap. */
  maxHeightLabel?: number;
  /** Current variant is considered unsafe when estimatedKbps < bitrateKbps * this ratio. */
  downgradeThresholdRatio: number;
  /** A higher variant is only attempted when estimatedKbps > itsBitrateKbps * this ratio. */
  upgradeThresholdRatio: number;
  /** How long the upgrade condition must hold continuously before switching up. */
  upgradeStableWindowMs: number;
  /** Consecutive unsafe samples required before a (non-stall-triggered) downgrade. */
  downgradeConsecutiveSamples: number;
  /** Safety margin used when picking *which* lower variant to fall back to. */
  downgradeSelectMargin: number;
}

export const QUALITY_MODE_PROFILES: Record<QualityMode, QualityModeProfile> = {
  auto: {
    maxHeightLabel: undefined,
    downgradeThresholdRatio: 0.9,
    upgradeThresholdRatio: 1.5,
    upgradeStableWindowMs: 15_000,
    downgradeConsecutiveSamples: 3,
    downgradeSelectMargin: 0.85,
  },
  economy: {
    maxHeightLabel: 480,
    downgradeThresholdRatio: 1.1,
    upgradeThresholdRatio: 2.0,
    upgradeStableWindowMs: 25_000,
    downgradeConsecutiveSamples: 2,
    downgradeSelectMargin: 0.75,
  },
  balanced: {
    maxHeightLabel: 720,
    downgradeThresholdRatio: 0.9,
    upgradeThresholdRatio: 1.5,
    upgradeStableWindowMs: 15_000,
    downgradeConsecutiveSamples: 3,
    downgradeSelectMargin: 0.85,
  },
  quality: {
    maxHeightLabel: undefined,
    downgradeThresholdRatio: 0.75,
    upgradeThresholdRatio: 1.2,
    upgradeStableWindowMs: 10_000,
    downgradeConsecutiveSamples: 4,
    downgradeSelectMargin: 0.9,
  },
};
