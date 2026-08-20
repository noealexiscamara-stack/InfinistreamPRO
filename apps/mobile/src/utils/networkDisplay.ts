import { NETWORK_QUALITY_LABELS, type NetworkState, type QualityMode, QUALITY_MODE_LABELS } from '@infiny-stream/types';

const NEUTRAL = '—';

/** True only when we have a real throughput reading — never invents "faible". */
export function hasNetworkMeasurement(state: NetworkState): boolean {
  return state.quality !== 'offline' && state.quality !== 'unknown' && state.estimatedThroughputKbps > 0;
}

/** Connection level — dash while unknown; offline only from system connectivity. */
export function connectionLevelLabel(state: NetworkState): string {
  if (state.quality === 'offline') return NETWORK_QUALITY_LABELS.offline;
  if (state.quality === 'unknown') return NEUTRAL;
  return NETWORK_QUALITY_LABELS[state.quality];
}

/** Headline + subtitle for the connection card / header. */
export function connectionDisplay(state: NetworkState): { title: string; subtitle: string } {
  if (state.quality === 'offline') {
    return { title: 'Hors ligne', subtitle: 'Aucune connexion' };
  }

  if (state.quality === 'unknown' || !hasNetworkMeasurement(state)) {
    return { title: NEUTRAL, subtitle: 'Mesure en attente' };
  }

  return {
    title: NETWORK_QUALITY_LABELS[state.quality],
    subtitle: state.isStable ? 'Connexion stable' : 'Mesure en cours',
  };
}

/** Current quality label from measured throughput. Neutral until a sample exists. */
export function currentQualityLabel(state: NetworkState): string {
  if (!hasNetworkMeasurement(state)) return NEUTRAL;
  if (state.estimatedThroughputKbps >= 4000) return '1080p FHD';
  if (state.estimatedThroughputKbps >= 1500) return '720p HD';
  return '480p SD';
}

export function qualityModeLabel(mode: QualityMode): string {
  return QUALITY_MODE_LABELS[mode];
}

export function throughputLabel(state: NetworkState): string | null {
  if (!hasNetworkMeasurement(state)) return null;
  const mbps = state.estimatedThroughputKbps / 1000;
  const formatted = mbps >= 10 ? mbps.toFixed(0) : mbps.toFixed(1).replace('.', ',');
  return `${formatted} Mb/s`;
}
