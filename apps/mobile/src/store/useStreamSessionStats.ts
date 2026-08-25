import { create } from 'zustand';

/**
 * Session-scoped counters for native stream sources (main player + radio).
 * Exposed on Diagnostic lecture so a tablet user can verify OPEN/RELEASE
 * balance without adb — `active` must stay ≤ 1 in normal single-stream use.
 */
interface StreamSessionStatsState {
  opened: number;
  released: number;
  active: number;
  lastOpenUrl: string | null;
  lastReleaseReason: string | null;
  recordOpen: (url: string) => void;
  recordRelease: (reason: string, url?: string | null) => void;
  reset: () => void;
}

export const useStreamSessionStats = create<StreamSessionStatsState>((set, get) => ({
  opened: 0,
  released: 0,
  active: 0,
  lastOpenUrl: null,
  lastReleaseReason: null,

  recordOpen: (url) => {
    set({
      opened: get().opened + 1,
      active: get().active + 1,
      lastOpenUrl: url.slice(0, 160),
    });
  },

  recordRelease: (reason, url) => {
    const { active } = get();
    if (active <= 0 && !url) return;
    set({
      released: get().released + 1,
      active: Math.max(0, get().active - 1),
      lastReleaseReason: reason,
    });
  },

  reset: () =>
    set({
      opened: 0,
      released: 0,
      active: 0,
      lastOpenUrl: null,
      lastReleaseReason: null,
    }),
}));
