import { create } from 'zustand';
import { storage } from '@/utils/mmkv';
import { extractPlayerError, formatTimeToFailure } from '@/services/playback/playbackError';

export { extractPlayerError, formatTimeToFailure };

const STORAGE_KEY = 'playback.diagnostics.failures';
const MAX_ENTRIES = 40;

export interface PlaybackFailureRecord {
  id: string;
  recordedAt: number;
  channelId: string;
  channelName: string;
  streamUrl: string;
  /** ExoPlayer / expo-video error code when available. */
  errorCode: string | null;
  errorMessage: string;
  /** Milliseconds from loadChannel / replace until error. */
  timeToFailureMs: number;
  rawErrorJson?: string;
}

interface PlaybackDiagnosticsState {
  failures: PlaybackFailureRecord[];
  recordFailure: (entry: Omit<PlaybackFailureRecord, 'id' | 'recordedAt'>) => void;
  clear: () => void;
}

function loadFailures(): PlaybackFailureRecord[] {
  try {
    const raw = storage.getString(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlaybackFailureRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFailures(failures: PlaybackFailureRecord[]): void {
  storage.set(STORAGE_KEY, JSON.stringify(failures));
}

export const usePlaybackDiagnosticsStore = create<PlaybackDiagnosticsState>((set, get) => ({
  failures: loadFailures(),
  recordFailure: (entry) => {
    const record: PlaybackFailureRecord = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      recordedAt: Date.now(),
    };
    const failures = [record, ...get().failures].slice(0, MAX_ENTRIES);
    saveFailures(failures);
    set({ failures });
  },
  clear: () => {
    saveFailures([]);
    set({ failures: [] });
  },
}));
