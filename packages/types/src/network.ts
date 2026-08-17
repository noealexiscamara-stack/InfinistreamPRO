/** Coarse network quality shown to the user — never raw metrics. */
export type NetworkQualityLevel = 'excellent' | 'good' | 'medium' | 'low' | 'offline';

export type QualityMode = 'auto' | 'economy' | 'balanced' | 'quality';

export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'unknown' | 'none';

/** One throughput/latency observation used by the network monitor's rolling window. */
export interface NetworkSample {
  timestampMs: number;
  /** Estimated download throughput in kbps for this sample. */
  throughputKbps: number;
  /** Round-trip/segment-fetch latency in ms, when measurable. */
  latencyMs?: number;
  connectionType: ConnectionType;
  /** True when the sample came from a stall/rebuffer event rather than a clean measurement. */
  fromStall: boolean;
}

export interface NetworkState {
  quality: NetworkQualityLevel;
  connectionType: ConnectionType;
  /** Smoothed throughput estimate in kbps. */
  estimatedThroughputKbps: number;
  isStable: boolean;
  lastUpdated: number;
}

/** One rendition of a stream, as advertised by the source (HLS master playlist, Xtream, etc.). */
export interface StreamVariant {
  id: string;
  /** Vertical resolution label used for display, e.g. 240, 360, 480, 720, 1080. */
  heightLabel: number;
  bitrateKbps: number;
  url: string;
}

export const QUALITY_MODE_LABELS: Record<QualityMode, string> = {
  auto: 'Automatique',
  economy: 'Économie',
  balanced: 'Équilibré',
  quality: 'Qualité',
};

export const NETWORK_QUALITY_LABELS: Record<NetworkQualityLevel, string> = {
  excellent: 'Excellente',
  good: 'Bonne',
  medium: 'Moyenne',
  low: 'Faible',
  offline: 'Hors ligne',
};
