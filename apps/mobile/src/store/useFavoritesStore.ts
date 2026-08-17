import { create } from 'zustand';
import * as repo from '@/services/favoritesHistoryRepository';

interface FavoritesState {
  favoriteIds: Set<string>;
  load: () => Promise<void>;
  toggle: (channelId: string, sourceId: string) => Promise<void>;
  isFavorite: (channelId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favoriteIds: new Set(),

  load: async () => {
    const favorites = await repo.listFavorites();
    set({ favoriteIds: new Set(favorites.map((f) => f.channelId)) });
  },

  toggle: async (channelId, sourceId) => {
    const isFav = get().favoriteIds.has(channelId);
    if (isFav) {
      await repo.removeFavorite(channelId);
    } else {
      await repo.addFavorite(channelId, sourceId);
    }
    set((state) => {
      const next = new Set(state.favoriteIds);
      if (isFav) next.delete(channelId);
      else next.add(channelId);
      return { favoriteIds: next };
    });
  },

  isFavorite: (channelId) => get().favoriteIds.has(channelId),
}));
