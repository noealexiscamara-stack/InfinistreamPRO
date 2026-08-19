import { XtreamClient } from '../client';

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const credentials = { serverUrl: 'http://example.com:8080/', username: 'user', password: 'pass' };

describe('Films', () => {
  it('maps a VOD listing, keeping the container the provider stated', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse([
        {
          stream_id: '101',
          name: 'Le Parrain',
          category_id: '7',
          stream_icon: 'http://x/poster.jpg',
          container_extension: 'mkv',
          rating: '9.2',
          added: '1600000000',
        },
      ])
    );
    const result = await new XtreamClient(credentials, fetchFn as never).getVodStreams();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]).toMatchObject({
      streamId: 101,
      name: 'Le Parrain',
      containerExtension: 'mkv',
      rating: 9.2,
      icon: 'http://x/poster.jpg',
    });
    expect(result.data[0].added).toMatch(/^20\d\d-/);
  });

  it('falls back to mp4 when the provider omits the container', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse([{ stream_id: 1, name: 'X', category_id: '1' }]));
    const result = await new XtreamClient(credentials, fetchFn as never).getVodStreams();
    if (!result.ok) throw new Error('expected ok');
    expect(result.data[0].containerExtension).toBe('mp4');
  });

  it('strips a leading dot the provider may include', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse([{ stream_id: 1, name: 'X', category_id: '1', container_extension: '.avi' }]));
    const result = await new XtreamClient(credentials, fetchFn as never).getVodStreams();
    if (!result.ok) throw new Error('expected ok');
    expect(result.data[0].containerExtension).toBe('avi');
  });

  it('leaves rating undefined rather than inventing a zero', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse([{ stream_id: 1, name: 'X', category_id: '1', rating: '' }]));
    const result = await new XtreamClient(credentials, fetchFn as never).getVodStreams();
    if (!result.ok) throw new Error('expected ok');
    expect(result.data[0].rating).toBeUndefined();
  });

  it('builds a playback URL carrying the right container', () => {
    const client = new XtreamClient(credentials, jest.fn());
    expect(client.buildVodStreamUrl(101, 'mkv')).toBe('http://example.com:8080/movie/user/pass/101.mkv');
    expect(client.buildVodStreamUrl(101, '.mp4')).toBe('http://example.com:8080/movie/user/pass/101.mp4');
  });

  it('reports a malformed listing instead of throwing', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ unexpected: true }));
    const result = await new XtreamClient(credentials, fetchFn as never).getVodStreams();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('malformed_response');
  });
});

describe('Séries', () => {
  it('maps a series listing with its metadata', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse([
        { series_id: '55', name: 'Engrenages', category_id: '9', cover: 'http://x/c.jpg', plot: 'Résumé', rating: '8.5' },
      ])
    );
    const result = await new XtreamClient(credentials, fetchFn as never).getSeries();
    if (!result.ok) throw new Error('expected ok');
    expect(result.data[0]).toMatchObject({ seriesId: 55, name: 'Engrenages', cover: 'http://x/c.jpg', rating: 8.5 });
  });

  it('flattens the season-keyed object Xtream returns', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse({
        info: { cover: 'http://x/c.jpg', plot: 'Résumé', genre: 'Policier' },
        episodes: {
          '1': [
            { id: '900', episode_num: '1', title: 'Pilote', container_extension: 'mkv', info: { duration_secs: '2700' } },
            { id: '901', episode_num: '2', title: 'Suite', container_extension: 'mkv', info: {} },
          ],
          '2': [{ id: '910', episode_num: '1', title: 'Retour', container_extension: 'mp4', info: {} }],
        },
      })
    );
    const result = await new XtreamClient(credentials, fetchFn as never).getSeriesInfo(55);
    if (!result.ok) throw new Error('expected ok');

    expect(result.data.seasons).toEqual([1, 2]);
    expect(result.data.episodes.map((e) => `${e.season}x${e.episode}`)).toEqual(['1x1', '1x2', '2x1']);
    expect(result.data.episodes[0]).toMatchObject({ episodeId: '900', title: 'Pilote', durationSeconds: 2700 });
    expect(result.data.genre).toBe('Policier');
  });

  it('trusts the season key over an unreliable season field', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse({
        info: {},
        episodes: {
          '3': [{ id: '1', episode_num: '4', title: 'E', season: 0, container_extension: 'mkv', info: {} }],
        },
      })
    );
    const result = await new XtreamClient(credentials, fetchFn as never).getSeriesInfo(55);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.episodes[0].season).toBe(3);
  });

  it('orders episodes across seasons regardless of key order', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse({
        info: {},
        episodes: {
          '2': [{ id: 'b', episode_num: '1', title: '', container_extension: 'mkv', info: {} }],
          '1': [{ id: 'a', episode_num: '10', title: '', container_extension: 'mkv', info: {} }],
        },
      })
    );
    const result = await new XtreamClient(credentials, fetchFn as never).getSeriesInfo(55);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.episodes.map((e) => e.episodeId)).toEqual(['a', 'b']);
  });

  it('survives a series with no episodes at all', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ info: {}, episodes: {} }));
    const result = await new XtreamClient(credentials, fetchFn as never).getSeriesInfo(55);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.episodes).toEqual([]);
    expect(result.data.seasons).toEqual([]);
  });

  it('survives episodes arriving as an array instead of an object', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ info: {}, episodes: [] }));
    const result = await new XtreamClient(credentials, fetchFn as never).getSeriesInfo(55);
    expect(result.ok).toBe(true);
  });

  it('builds an episode playback URL', () => {
    const client = new XtreamClient(credentials, jest.fn());
    expect(client.buildEpisodeStreamUrl('900', 'mkv')).toBe('http://example.com:8080/series/user/pass/900.mkv');
  });
});

describe('Catégories VOD et séries', () => {
  it.each([
    ['getVodCategories', 'get_vod_categories'],
    ['getSeriesCategories', 'get_series_categories'],
  ])('%s calls %s and maps the result', async (method, action) => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse([{ category_id: '3', category_name: 'Action' }]));
    const client = new XtreamClient(credentials, fetchFn as never);
    const result = await (client as never as Record<string, () => Promise<never>>)[method]();

    expect((fetchFn.mock.calls[0][0] as string)).toContain(`action=${action}`);
    expect(result).toMatchObject({ ok: true, data: [{ categoryId: '3', categoryName: 'Action' }] });
  });
});

describe('Erreurs', () => {
  it('reports invalid credentials on 401 for VOD too', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({}, 401));
    const result = await new XtreamClient(credentials, fetchFn as never).getVodStreams();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_credentials');
  });

  it('reports a network failure rather than throwing', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await new XtreamClient(credentials, fetchFn as never).getSeries();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('network');
  });
});
