import type { NetworkQualityLevel } from '@infiny-stream/types';

/**
 * kbps thresholds used to translate a raw throughput estimate into the
 * simple indicator shown to the user (Excellente/Bonne/Moyenne/Faible).
 *
 * IMPORTANT: this function never returns 'offline'. Offline is a system
 * connectivity fact (no link / not reachable), not a throughput conclusion.
 * Zero or missing throughput → 'unknown' (UI shows a dash).
 */
export const NETWORK_QUALITY_THRESHOLDS_KBPS = {
  low: 500,
  medium: 1500,
  good: 4000,
} as const;

export function classifyNetworkQuality(estimatedKbps: number, isStable: boolean): NetworkQualityLevel {
  if (estimatedKbps <= 0) return 'unknown';

  let level: NetworkQualityLevel;
  if (estimatedKbps < NETWORK_QUALITY_THRESHOLDS_KBPS.low) {
    level = 'low';
  } else if (estimatedKbps < NETWORK_QUALITY_THRESHOLDS_KBPS.medium) {
    level = 'medium';
  } else if (estimatedKbps < NETWORK_QUALITY_THRESHOLDS_KBPS.good) {
    level = 'good';
  } else {
    level = 'excellent';
  }

  // An unstable connection is downgraded one notch in the *displayed*
  // indicator, even if raw throughput is high — a jumpy 5 Mbps link feels
  // worse to the user than a steady 2 Mbps one.
  if (!isStable && level === 'excellent') return 'good';
  if (!isStable && level === 'good') return 'medium';
  return level;
}
