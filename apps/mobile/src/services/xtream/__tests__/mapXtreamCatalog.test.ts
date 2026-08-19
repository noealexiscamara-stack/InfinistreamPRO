import {
  buildXtreamChannelsFromFetch,
  formatDisplayRating,
  mapXtreamSeriesEpisodes,
  mapXtreamVodStreams,
  type PersistableChannel,
} from '@/services/xtream/mapXtreamCatalog';

const client = {
  buildLiveStreamUrl: (id: number) => `http://example.com/live/u/p/${id}.m3u8`,
  buildVodStreamUrl: (id: number, ext: string) => `http://example.com/movie/u/p/${id}.${ext.replace(/^\./, '')}`,
  buildEpisodeStreamUrl: (id: string, ext: string) => `http://example.com/series/u/p/${id}.${ext.replace(/^\./, '')}`,
};

const categories = new Map([
  ['1', 'Films FR'],
  ['2', 'Séries FR'],
  ['9', 'Live FR'],
]);

describe('formatDisplayRating', () => {
  it('hides zero and missing ratings', () => {
    expect(formatDisplayRating(undefined)).toBeNull();
    expect(formatDisplayRating(0)).toBeNull();
    expect(formatDisplayRating(-1)).toBeNull();
  });

  it('shows positive ratings', () => {
    expect(formatDisplayRating(7.5)).toBe('7.5');
  });
});

describe('mapXtreamVodStreams', () => {
  it('maps poster, rating and container extension', () => {
    const [movie] = mapXtreamVodStreams(
      [
        {
          streamId: 42,
          name: 'Inception',
          categoryId: '1',
          icon: 'http://cdn/inception.jpg',
          containerExtension: 'mkv',
          rating: 8.8,
          added: '2024-01-01T00:00:00.000Z',
        },
      ],
      client,
      categories
    );

    expect(movie).toMatchObject({
      name: 'Inception',
      kind: 'movie',
      logoUrl: 'http://cdn/inception.jpg',
      rating: 8.8,
      containerExtension: 'mkv',
      xtreamStreamId: 42,
      streamUrl: 'http://example.com/movie/u/p/42.mkv',
      groupTitle: 'Films FR',
    });
  });
});

describe('buildXtreamChannelsFromFetch', () => {
  it('imports live even when VOD is unavailable', () => {
    const result = buildXtreamChannelsFromFetch('src1', client, categories, {
      live: {
        ok: true,
        data: [{ streamId: 1, name: 'TF1', categoryId: '9', streamIcon: 'http://logo' }],
      },
      vod: { ok: false, error: 'server_error', message: 'VOD indisponible' },
      series: { ok: true, data: [] },
    });

    expect(result.vodAvailable).toBe(false);
    expect(result.vodError).toBe('VOD indisponible');
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0]).toMatchObject({ name: 'TF1', kind: 'live' });
  });

  it('includes movies and series catalog rows when APIs succeed', () => {
    const result = buildXtreamChannelsFromFetch('src1', client, categories, {
      live: { ok: true, data: [] },
      vod: {
        ok: true,
        data: [
          {
            streamId: 10,
            name: 'Heat',
            categoryId: '1',
            containerExtension: 'mp4',
          },
        ],
      },
      series: {
        ok: true,
        data: [
          {
            seriesId: 55,
            name: 'Breaking Bad',
            categoryId: '2',
            cover: 'http://cover/bb.jpg',
            plot: 'A teacher cooks.',
            genre: 'Drama',
            rating: 9,
          },
        ],
      },
    });

    expect(result.vodAvailable).toBe(true);
    expect(result.seriesAvailable).toBe(true);
    expect(result.channels).toHaveLength(2);

    const movie = result.channels.find((c) => c.kind === 'movie');
    const series = result.channels.find((c) => c.kind === 'series');

    expect(movie?.streamUrl).toBe('http://example.com/movie/u/p/10.mp4');
    expect(series).toMatchObject({
      name: 'Breaking Bad',
      logoUrl: 'http://cover/bb.jpg',
      plot: 'A teacher cooks.',
      genre: 'Drama',
      rating: 9,
      xtreamSeriesId: 55,
      streamUrl: 'infiny-stream://xtream/series/src1/55',
    });
  });

  it('throws when live import fails', () => {
    expect(() =>
      buildXtreamChannelsFromFetch('src1', client, categories, {
        live: { ok: false, error: 'network', message: 'offline' },
        vod: { ok: true, data: [] },
        series: { ok: true, data: [] },
      })
    ).toThrow('offline');
  });
});

describe('mapXtreamSeriesEpisodes', () => {
  it('uses seasons from getSeriesInfo and builds episode playback URLs', () => {
    const episodes = mapXtreamSeriesEpisodes(
      { id: 'src1' },
      55,
      'Dark',
      {
        seriesId: 55,
        episodes: [
          {
            episodeId: '900',
            season: 2,
            episode: 3,
            title: 'Ghosts',
            containerExtension: 'mkv',
          },
        ],
        seasons: [2],
      },
      client
    );

    expect(episodes[0]).toMatchObject({
      xtreamSeriesId: 55,
      xtreamEpisodeId: '900',
      containerExtension: 'mkv',
      streamUrl: 'http://example.com/series/u/p/900.mkv',
      name: 'Dark S02E03 — Ghosts',
    });
  });
});
