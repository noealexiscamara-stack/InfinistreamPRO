import { useSourcesStore } from '@/store/useSourcesStore';
import type { Source } from '@infiny-stream/types';

jest.mock('@/services/sourcesRepository', () => ({
  createSource: jest.fn(),
  deleteSource: jest.fn(),
  getSource: jest.fn(),
  listSources: jest.fn(),
  markSourceError: jest.fn(),
  renameSource: jest.fn(),
}));

jest.mock('@/services/xtream/importXtream', () => ({
  verifyXtreamCredentials: jest.fn(),
  importXtreamSource: jest.fn(),
}));

jest.mock('@/services/m3u/importM3u', () => ({
  importM3uSource: jest.fn(),
}));

import * as sourcesRepo from '@/services/sourcesRepository';
import { importXtreamSource, verifyXtreamCredentials } from '@/services/xtream/importXtream';

const xtreamSource: Source = {
  id: 'src-xtream',
  type: 'xtream',
  name: 'Holo TV',
  serverUrl: 'http://example.com:8080',
  username: 'user',
  password: 'pass',
  channelCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('useSourcesStore.addXtream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSourcesStore.setState({
      sources: [],
      isLoading: false,
      selectedSourceId: null,
      refreshingSourceId: null,
    });
  });

  it('deletes the source row when import fails so no orphan remains', async () => {
    (verifyXtreamCredentials as jest.Mock).mockResolvedValue({ status: 'ok' });
    (sourcesRepo.createSource as jest.Mock).mockResolvedValue(xtreamSource);
    (sourcesRepo.deleteSource as jest.Mock).mockResolvedValue(undefined);
    (sourcesRepo.listSources as jest.Mock).mockResolvedValue([]);
    (importXtreamSource as jest.Mock).mockRejectedValue(new Error('Maximum call stack size exceeded'));

    await expect(
      useSourcesStore.getState().addXtream('Holo TV', xtreamSource.serverUrl!, xtreamSource.username!, xtreamSource.password!)
    ).rejects.toThrow('Maximum call stack size exceeded');

    expect(sourcesRepo.deleteSource).toHaveBeenCalledWith('src-xtream');
    expect(importXtreamSource).toHaveBeenCalledWith(xtreamSource, undefined, { auth: { status: 'ok' } });
    expect(useSourcesStore.getState().sources).toEqual([]);
  });

  it('passes progress callbacks through to importXtreamSource', async () => {
    (verifyXtreamCredentials as jest.Mock).mockResolvedValue({ status: 'ok' });
    (sourcesRepo.createSource as jest.Mock).mockResolvedValue(xtreamSource);
    (sourcesRepo.listSources as jest.Mock).mockResolvedValue([xtreamSource]);
    (importXtreamSource as jest.Mock).mockResolvedValue({
      channelCount: 1,
      duplicatesRemoved: 0,
      rejected: 0,
      ignored: 0,
      summary: '1 chaîne importée',
    });

    const onProgress = jest.fn();
    await useSourcesStore.getState().addXtream('Holo TV', xtreamSource.serverUrl!, xtreamSource.username!, xtreamSource.password!, onProgress);

    expect(onProgress).toHaveBeenCalledWith({ phase: 'connecting', step: 'live' });
    expect(importXtreamSource).toHaveBeenCalledWith(xtreamSource, onProgress, { auth: { status: 'ok' } });
  });

  it('refreshSource reuses the existing source instead of creating a new one', async () => {
    (sourcesRepo.getSource as jest.Mock).mockResolvedValue(xtreamSource);
    (sourcesRepo.listSources as jest.Mock).mockResolvedValue([{ ...xtreamSource, channelCount: 120 }]);
    (importXtreamSource as jest.Mock).mockResolvedValue({
      channelCount: 120,
      duplicatesRemoved: 0,
      rejected: 0,
      ignored: 0,
      summary: '120 chaînes importées',
    });

    const result = await useSourcesStore.getState().refreshSource('src-xtream');

    expect(sourcesRepo.createSource).not.toHaveBeenCalled();
    expect(importXtreamSource).toHaveBeenCalledWith(xtreamSource, undefined);
    expect(result).toMatchObject({ channelCount: 120 });
  });
});
