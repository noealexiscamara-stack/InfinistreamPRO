import type { VideoContentFit } from 'expo-video';

/** User-facing aspect / fit modes for the player. */
export type PlayerAspectMode = 'fit' | 'fill' | 'stretch' | 'ratio16x9' | 'ratio4x3';

export const PLAYER_ASPECT_MODES: PlayerAspectMode[] = [
  'fit',
  'fill',
  'stretch',
  'ratio16x9',
  'ratio4x3',
];

const MODE_LABELS: Record<PlayerAspectMode, string> = {
  fit: 'Ajusté',
  fill: 'Rempli',
  stretch: 'Étiré',
  ratio16x9: '16:9',
  ratio4x3: '4:3',
};

export function playerAspectModeLabel(mode: PlayerAspectMode): string {
  return MODE_LABELS[mode];
}

export function isValidPlayerAspectMode(value: string | undefined): value is PlayerAspectMode {
  return PLAYER_ASPECT_MODES.includes(value as PlayerAspectMode);
}

export function nextPlayerAspectMode(mode: PlayerAspectMode): PlayerAspectMode {
  const index = PLAYER_ASPECT_MODES.indexOf(mode);
  return PLAYER_ASPECT_MODES[(index + 1) % PLAYER_ASPECT_MODES.length];
}

/** Maps fit modes to expo-video contentFit; forced ratios always use contain inside a sized box. */
export function contentFitForAspectMode(mode: PlayerAspectMode): VideoContentFit {
  switch (mode) {
    case 'fit':
    case 'ratio16x9':
    case 'ratio4x3':
      return 'contain';
    case 'fill':
      return 'cover';
    case 'stretch':
      return 'fill';
    default:
      return 'contain';
  }
}

export function forcedAspectRatio(mode: PlayerAspectMode): number | null {
  if (mode === 'ratio16x9') return 16 / 9;
  if (mode === 'ratio4x3') return 4 / 3;
  return null;
}
