import type { NetworkQualityLevel } from '@infiny-stream/types';

/**
 * kbps thresholds used to translate a raw throughput estimate into the
 * simple 4-level indicator shown to the user (Excellente/Bonne/Moyenne/
 * Faible). Roughly aligned with typical live-stream renditions so the
 * label tracks what quality the user can expect:
 *   < 500      -> low      (240p territory)
 *   500-1500   -> medium   (360p/480p)
 *   1500-4000  -> good     (480p/720p)
 *   > 4000     -> excellent(720p/1080p)
 * These are intentionally centralized here rather than duplicated across
 * screens, so the indicator and the actual variant selection never
 * disagree with each other.
 */
export const NETWORK_QUALITY_THRESHOLDS_KBPS = {
  low: 500,
  medium: 1500,
  good: 4000,
} as const;

export function classifyNetworkQuality(estimatedKbps: number, isStable: boolean): NetworkQualityLevel {
  if (estimatedKbps <= 0) return 'offline';

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
