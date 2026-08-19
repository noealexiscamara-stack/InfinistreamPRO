import { NETWORK_QUALITY_LABELS, type NetworkState, type QualityMode, QUALITY_MODE_LABELS } from '@infiny-stream/types';

const NEUTRAL = '—';

export function hasNetworkMeasurement(state: NetworkState): boolean {
  return state.quality === 'offline' || state.estimatedThroughputKbps > 0;
}

/** Connection level — uses OS/provisional quality before playback measurements exist. */
export function connectionLevelLabel(state: NetworkState): string {
  if (state.quality === 'offline') return NETWORK_QUALITY_LABELS.offline;
  return NETWORK_QUALITY_LABELS[state.quality];
}

/** Headline + subtitle for the connection card header. */
export function connectionDisplay(state: NetworkState): { title: string; subtitle: string } {
  if (state.quality === 'offline') {
    return { title: 'Hors ligne', subtitle: 'Aucune connexion' };
  }

  const title = NETWORK_QUALITY_LABELS[state.quality];

  if (hasNetworkMeasurement(state)) {
    return {
      title,
      subtitle: state.isStable ? 'Connexion stable' : 'Mesure en cours',
    };
  }

  if (state.connectionType === 'wifi' || state.connectionType === 'ethernet') {
    return { title, subtitle: 'Connexion stable' };
  }

  if (state.connectionType === 'cellular') {
    return { title, subtitle: 'Réseau mobile' };
  }

  return { title, subtitle: 'Connexion détectée' };
}

/** Current quality label from measured throughput. Neutral until a sample exists. */
export function currentQualityLabel(state: NetworkState): string {
  if (state.quality === 'offline' || state.estimatedThroughputKbps <= 0) return NEUTRAL;
  if (state.estimatedThroughputKbps >= 4000) return '1080p FHD';
  if (state.estimatedThroughputKbps >= 1500) return '720p HD';
  return '480p SD';
}

export function qualityModeLabel(mode: QualityMode): string {
  return QUALITY_MODE_LABELS[mode];
}

export function throughputLabel(state: NetworkState): string | null {
  if (!hasNetworkMeasurement(state) || state.quality === 'offline') return null;
  const mbps = state.estimatedThroughputKbps / 1000;
  const formatted = mbps >= 10 ? mbps.toFixed(0) : mbps.toFixed(1).replace('.', ',');
  return `${formatted} Mb/s`;
}
