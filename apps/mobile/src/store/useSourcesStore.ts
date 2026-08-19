import { create } from 'zustand';
import type { Source } from '@infiny-stream/types';
import * as sourcesRepo from '@/services/sourcesRepository';
import { importM3uSource, type ImportProgress, type ImportResult } from '@/services/m3u/importM3u';
import { importXtreamSource, type XtreamImportResult } from '@/services/xtream/importXtream';

type ImportStats = Pick<ImportResult, 'channelCount' | 'ignored' | 'summary'>;

interface SourcesState {
  sources: Source[];
  isLoading: boolean;
  selectedSourceId: string | null;
  refreshingSourceId: string | null;

  load: () => Promise<void>;
  selectSource: (id: string) => void;
  addM3uUrl: (name: string, url: string, onProgress?: (p: ImportProgress) => void) => Promise<{ source: Source } & ImportStats>;
  addM3uFile: (name: string, fileUri: string, onProgress?: (p: ImportProgress) => void) => Promise<{ source: Source } & ImportStats>;
  addXtream: (name: string, serverUrl: string, username: string, password: string) => Promise<{ source: Source } & ImportStats>;
  refreshSource: (id: string, onProgress?: (p: ImportProgress) => void) => Promise<ImportStats | void>;
  removeSource: (id: string) => Promise<void>;
  renameSource: (id: string, name: string) => Promise<void>;
}

function statsFromM3u(result: ImportResult): ImportStats {
  return { channelCount: result.channelCount, ignored: result.ignored, summary: result.summary };
}

function statsFromXtream(result: XtreamImportResult): ImportStats {
  return { channelCount: result.channelCount, ignored: result.ignored, summary: result.summary };
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
    const result = await get().refreshSource(source.id, onProgress);
    return { source, channelCount: result?.channelCount ?? 0, ignored: result?.ignored ?? 0, summary: result?.summary ?? '' };
  },

  addM3uFile: async (name, fileUri, onProgress) => {
    const source = await sourcesRepo.createSource({ type: 'm3u_file', name, fileUri });
    set((state) => ({ sources: [...state.sources, source], selectedSourceId: source.id }));
    const result = await get().refreshSource(source.id, onProgress);
    return { source, channelCount: result?.channelCount ?? 0, ignored: result?.ignored ?? 0, summary: result?.summary ?? '' };
  },

  addXtream: async (name, serverUrl, username, password) => {
    const source = await sourcesRepo.createSource({ type: 'xtream', name, serverUrl, username, password });
    set((state) => ({ sources: [...state.sources, source], selectedSourceId: source.id }));
    set({ refreshingSourceId: source.id });
    try {
      if (source.type !== 'xtream') throw new Error('unreachable');
      const imported = await importXtreamSource(source);
      await get().load();
      return { source, ...statsFromXtream(imported) };
    } catch (err) {
      await sourcesRepo.markSourceError(source.id, err instanceof Error ? err.message : 'Erreur inconnue');
      await get().load();
      throw err;
    } finally {
      set({ refreshingSourceId: null });
    }
  },

  refreshSource: async (id, onProgress) => {
    const source = await sourcesRepo.getSource(id);
    if (!source) return;
    set({ refreshingSourceId: id });
    try {
      if (source.type === 'm3u_url' || source.type === 'm3u_file') {
        const imported = await importM3uSource(source, onProgress);
        await get().load();
        return statsFromM3u(imported);
      }
      if (source.type === 'xtream') {
        const imported = await importXtreamSource(source);
        await get().load();
        return statsFromXtream(imported);
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
