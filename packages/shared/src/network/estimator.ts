import type { NetworkSample } from '@infiny-stream/types';

export interface ThroughputEstimatorConfig {
  /** Max number of samples kept in the rolling window. */
  windowSize: number;
  /**
   * Exponential smoothing factor (0..1) applied to the harmonic mean of the
   * window on every update. Higher = reacts faster to new samples, lower =
   * smoother/less jumpy. Harmonic mean (rather than arithmetic mean) is used
   * because it penalizes low-throughput samples more — the same bias
   * ExoPlayer's own bandwidth meter uses, since a single slow segment hurts
   * playback far more than a single fast one helps it.
   */
  emaAlpha: number;
  /** Coefficient of variation (stddev / mean) below which the connection is considered "stable". */
  stabilityThreshold: number;
}

export const DEFAULT_ESTIMATOR_CONFIG: ThroughputEstimatorConfig = {
  windowSize: 20,
  emaAlpha: 0.35,
  stabilityThreshold: 0.35,
};

function harmonicMean(values: number[]): number {
  const positive = values.filter((v) => v > 0);
  if (positive.length === 0) return 0;
  const sumOfInverses = positive.reduce((acc, v) => acc + 1 / v, 0);
  return positive.length / sumOfInverses;
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Rolling estimator of real-world throughput, fed by segment/manifest
 * download timings (and, as a strong negative signal, rebuffer events).
 * This is deliberately conservative: it is the basis the whole adaptive
 * quality decision relies on, and under-estimating is far less harmful
 * than over-estimating (over-estimating causes stalls).
 */
export class ThroughputEstimator {
  private readonly config: ThroughputEstimatorConfig;
  private samples: NetworkSample[] = [];
  private smoothedKbps = 0;

  constructor(config: Partial<ThroughputEstimatorConfig> = {}) {
    this.config = { ...DEFAULT_ESTIMATOR_CONFIG, ...config };
  }

  addSample(sample: NetworkSample): void {
    this.samples.push(sample);
    if (this.samples.length > this.config.windowSize) {
      this.samples.shift();
    }

    const windowMean = harmonicMean(this.samples.map((s) => s.throughputKbps));
    this.smoothedKbps =
      this.smoothedKbps === 0
        ? windowMean
        : this.config.emaAlpha * windowMean + (1 - this.config.emaAlpha) * this.smoothedKbps;

    // A rebuffer is ground truth: the current estimate was too optimistic.
    // Snap the smoothed estimate down immediately instead of waiting for
    // the EMA to catch up over several samples.
    if (sample.fromStall) {
      this.smoothedKbps = Math.min(this.smoothedKbps, sample.throughputKbps);
    }
  }

  reset(): void {
    this.samples = [];
    this.smoothedKbps = 0;
  }

  get estimatedKbps(): number {
    return Math.round(this.smoothedKbps);
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  /** True when recent throughput samples are close to each other (low variance). */
  get isStable(): boolean {
    if (this.samples.length < 3) return false;
    const values = this.samples.map((s) => s.throughputKbps);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return false;
    const cv = standardDeviation(values, mean) / mean;
    return cv <= this.config.stabilityThreshold;
  }

  get recentLatencyMs(): number | undefined {
    const withLatency = this.samples.filter((s) => typeof s.latencyMs === 'number');
    if (withLatency.length === 0) return undefined;
    const sum = withLatency.reduce((acc, s) => acc + (s.latencyMs ?? 0), 0);
    return Math.round(sum / withLatency.length);
  }
}
