import { create } from 'zustand';
import type { Source } from '@infiny-stream/types';
import * as sourcesRepo from '@/services/sourcesRepository';
import { importM3uSource, type ImportProgress } from '@/services/m3u/importM3u';
import { importXtreamSource } from '@/services/xtream/importXtream';

interface SourcesState {
  sources: Source[];
  isLoading: boolean;
  selectedSourceId: string | null;
  refreshingSourceId: string | null;

  load: () => Promise<void>;
  selectSource: (id: string) => void;
  addM3uUrl: (name: string, url: string, onProgress?: (p: ImportProgress) => void) => Promise<Source>;
  addM3uFile: (name: string, fileUri: string, onProgress?: (p: ImportProgress) => void) => Promise<Source>;
  addXtream: (name: string, serverUrl: string, username: string, password: string) => Promise<Source>;
  refreshSource: (id: string, onProgress?: (p: ImportProgress) => void) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  renameSource: (id: string, name: string) => Promise<void>;
}

export const useSourcesStore = create<SourcesState>((set, get) => ({
  sources: [],
  isLoading: false,
  selectedSourceId: null,
  refreshingSourceId: null,

  load: async () => {
    set({ isLoading: true });
    const sources = await sourcesRepo.listSources();
    set((state) => ({
      sources,
      isLoading: false,
      selectedSourceId: state.selectedSourceId ?? sources[0]?.id ?? null,
    }));
  },

  selectSource: (id) => set({ selectedSourceId: id }),

  addM3uUrl: async (name, url, onProgress) => {
    const source = await sourcesRepo.createSource({ type: 'm3u_url', name, url });
    set((state) => ({ sources: [...state.sources, source], selectedSourceId: source.id }));
    await get().refreshSource(source.id, onProgress);
    return source;
  },

  addM3uFile: async (name, fileUri, onProgress) => {
    const source = await sourcesRepo.createSource({ type: 'm3u_file', name, fileUri });
    set((state) => ({ sources: [...state.sources, source], selectedSourceId: source.id }));
    await get().refreshSource(source.id, onProgress);
    return source;
  },

  addXtream: async (name, serverUrl, username, password) => {
    const source = await sourcesRepo.createSource({ type: 'xtream', name, serverUrl, username, password });
    set((state) => ({ sources: [...state.sources, source], selectedSourceId: source.id }));
    set({ refreshingSourceId: source.id });
    try {
      if (source.type !== 'xtream') throw new Error('unreachable');
      await importXtreamSource(source);
      await get().load();
    } catch (err) {
      await sourcesRepo.markSourceError(source.id, err instanceof Error ? err.message : 'Erreur inconnue');
      await get().load();
      throw err;
    } finally {
      set({ refreshingSourceId: null });
    }
    return source;
  },

  refreshSource: async (id, onProgress) => {
    const source = await sourcesRepo.getSource(id);
    if (!source) return;
    set({ refreshingSourceId: id });
    try {
      if (source.type === 'm3u_url' || source.type === 'm3u_file') {
        await importM3uSource(source, onProgress);
      } else if (source.type === 'xtream') {
        await importXtreamSource(source);
      }
      await get().load();
    } catch (err) {
      await sourcesRepo.markSourceError(id, err instanceof Error ? err.message : 'Erreur inconnue');
      await get().load();
      throw err;
    } finally {
      set({ refreshingSourceId: null });
    }
  },

  removeSource: async (id) => {
    await sourcesRepo.deleteSource(id);
    set((state) => ({
      sources: state.sources.filter((s) => s.id !== id),
      selectedSourceId: state.selectedSourceId === id ? null : state.selectedSourceId,
    }));
  },

  renameSource: async (id, name) => {
    await sourcesRepo.renameSource(id, name);
    set((state) => ({ sources: state.sources.map((s) => (s.id === id ? { ...s, name } : s)) }));
  },
}));
