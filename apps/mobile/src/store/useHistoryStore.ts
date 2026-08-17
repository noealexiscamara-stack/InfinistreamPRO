import { create } from 'zustand';
import type { HistoryEntry } from '@infiny-stream/types';
import * as repo from '@/services/favoritesHistoryRepository';

interface HistoryState {
  entries: HistoryEntry[];
  load: () => Promise<void>;
  record: (entry: Omit<HistoryEntry, 'lastWatchedAt'>) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],

  load: async () => {
    const entries = await repo.listHistory();
    set({ entries });
  },

  record: async (entry) => {
    await repo.recordHistory(entry);
    await get().load();
  },
}));
