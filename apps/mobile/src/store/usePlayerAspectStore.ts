import { create } from 'zustand';
import {
  isValidPlayerAspectMode,
  type PlayerAspectMode,
} from '@/services/playback/playerAspectRatio';
import { storage } from '@/utils/mmkv';

const STORAGE_KEY = 'player.aspectMode';

interface PlayerAspectState {
  aspectMode: PlayerAspectMode;
  setAspectMode: (mode: PlayerAspectMode) => void;
}

export const usePlayerAspectStore = create<PlayerAspectState>((set) => ({
  aspectMode: (() => {
    const saved = storage.getString(STORAGE_KEY);
    return isValidPlayerAspectMode(saved) ? saved : 'fit';
  })(),

  setAspectMode: (mode) => {
    storage.set(STORAGE_KEY, mode);
    set({ aspectMode: mode });
  },
}));
