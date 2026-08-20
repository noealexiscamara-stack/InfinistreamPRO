import { create } from 'zustand';

/**
 * Read-only playback quality from expo-video `videoTrack` / `videoTrackChange`.
 * Home status shows "—" when nothing is playing; the player updates this store.
 */
interface PlaybackQualityState {
  /** Vertical resolution in pixels, or null when unknown / not playing. */
  height: number | null;
  setHeight: (height: number | null) => void;
  clear: () => void;
}

export const usePlaybackQualityStore = create<PlaybackQualityState>((set) => ({
  height: null,
  setHeight: (height) => set({ height }),
  clear: () => set({ height: null }),
}));

export function formatPlaybackHeight(height: number | null | undefined): string {
  if (height == null || !Number.isFinite(height) || height <= 0) return '—';
  if (height >= 2160) return '2160p 4K';
  if (height >= 1080) return '1080p FHD';
  if (height >= 720) return '720p HD';
  if (height >= 480) return '480p SD';
  if (height >= 360) return '360p';
  return `${Math.round(height)}p`;
}
