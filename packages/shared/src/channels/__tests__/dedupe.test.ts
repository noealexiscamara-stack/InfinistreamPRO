import { dedupeChannelsByUrl, dedupeXtreamByProviderId } from '../dedupe';
import { channelId, stableHash } from '../../utils/id';

const ch = (name: string, streamUrl: string) => ({ name, streamUrl });

describe('dedupeChannelsByUrl', () => {
  it('collapses the same stream listed under several categories', () => {
    // The exact shape of iptv-org's index.category.m3u, which broke the
    // real import: one entry per category, identical URL.
    const { channels, duplicatesRemoved } = dedupeChannelsByUrl([
      ch('France 24', 'http://x/france24.m3u8'),
      ch('France 24', 'http://x/france24.m3u8'),
      ch('France 24', 'http://x/france24.m3u8'),
    ]);

    expect(channels).toHaveLength(1);
    expect(duplicatesRemoved).toBe(2);
  });

  it('keeps the first occurrence, not the last', () => {
    const { channels } = dedupeChannelsByUrl([
      ch('TF1 — Généraliste', 'http://x/tf1'),
      ch('TF1 — Divertissement', 'http://x/tf1'),
    ]);
    expect(channels[0].name).toBe('TF1 — Généraliste');
  });

  it('leaves genuinely distinct channels alone', () => {
    const { channels, duplicatesRemoved } = dedupeChannelsByUrl([
      ch('TF1', 'http://x/1'),
      ch('France 2', 'http://x/2'),
      ch('M6', 'http://x/3'),
    ]);
    expect(channels).toHaveLength(3);
    expect(duplicatesRemoved).toBe(0);
  });

  it('does not merge two channels that merely share a name', () => {
    const { channels } = dedupeChannelsByUrl([
      ch('Sport', 'http://server-a/sport'),
      ch('Sport', 'http://server-b/sport'),
    ]);
    // Different URLs are different streams — and keeping both gives the
    // player a fallback when one origin dies.
    expect(channels).toHaveLength(2);
  });

  it('handles an empty playlist', () => {
    expect(dedupeChannelsByUrl([])).toEqual({ channels: [], duplicatesRemoved: 0 });
  });

  it('guarantees every surviving entry yields a distinct channel id', () => {
    const raw = [
      ch('A', 'http://x/1'),
      ch('A bis', 'http://x/1'),
      ch('B', 'http://x/2'),
      ch('B bis', 'http://x/2'),
      ch('C', 'http://x/3'),
    ];
    const { channels } = dedupeChannelsByUrl(raw);
    const ids = channels.map((c) => channelId('src1', c.streamUrl));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('dedupeXtreamByProviderId', () => {
  it('drops the same vod stream_id with different container extensions', () => {
    // URL dedupe alone keeps both — /movie/…/101.mp4 ≠ /movie/…/101.mkv
    const raw = [
      {
        name: 'Inception',
        streamUrl: 'http://x/movie/u/p/101.mp4',
        kind: 'movie' as const,
        xtreamStreamId: 101,
      },
      {
        name: 'Inception',
        streamUrl: 'http://x/movie/u/p/101.mkv',
        kind: 'movie' as const,
        xtreamStreamId: 101,
      },
      {
        name: 'Other',
        streamUrl: 'http://x/movie/u/p/102.mp4',
        kind: 'movie' as const,
        xtreamStreamId: 102,
      },
    ];
    const byUrl = dedupeChannelsByUrl(raw);
    expect(byUrl.channels).toHaveLength(3);

    const { channels, duplicatesRemoved } = dedupeXtreamByProviderId(byUrl.channels);
    expect(channels).toHaveLength(2);
    expect(duplicatesRemoved).toBe(1);

    // SQL-shaped proof: SELECT title, COUNT(*) … HAVING COUNT(*) > 1
    const beforeTitles = new Map<string, number>();
    for (const row of byUrl.channels) {
      beforeTitles.set(row.name, (beforeTitles.get(row.name) ?? 0) + 1);
    }
    const beforeDupes = [...beforeTitles.entries()].filter(([, c]) => c > 1);
    expect(beforeDupes).toEqual([['Inception', 2]]);

    const afterTitles = new Map<string, number>();
    for (const row of channels) {
      afterTitles.set(row.name, (afterTitles.get(row.name) ?? 0) + 1);
    }
    const afterDupes = [...afterTitles.entries()].filter(([, c]) => c > 1);
    expect(afterDupes).toEqual([]);
    expect(byUrl.channels.length).toBe(3); // movie total before
    expect(channels.length).toBe(2); // movie total after
  });

  it('keeps live and movie that share a numeric stream_id (kind in key)', () => {
    const { channels, duplicatesRemoved } = dedupeXtreamByProviderId([
      { name: 'TF1', streamUrl: 'http://x/live/u/p/42.m3u8', kind: 'live', xtreamStreamId: 42 },
      { name: 'Film 42', streamUrl: 'http://x/movie/u/p/42.mp4', kind: 'movie', xtreamStreamId: 42 },
    ]);
    expect(channels).toHaveLength(2);
    expect(duplicatesRemoved).toBe(0);
  });
});

describe('stableHash width', () => {
  it('is wide enough that a large playlist does not collide', () => {
    // The old 32-bit id started colliding around 20 000 synthetic URLs,
    // which is an ordinary size for an aggregate IPTV playlist.
    const ids = new Set<string>();
    for (let i = 0; i < 50_000; i++) {
      ids.add(channelId('src1', `http://provider.example/live/user/pass/${i}.ts`));
    }
    expect(ids.size).toBe(50_000);
  });

  it('stays deterministic across calls', () => {
    expect(stableHash('infiny')).toBe(stableHash('infiny'));
    expect(channelId('s', 'u')).toBe(channelId('s', 'u'));
  });

  it('separates inputs that differ only slightly', () => {
    expect(stableHash('http://x/1')).not.toBe(stableHash('http://x/2'));
    expect(channelId('src1', 'http://x/1')).not.toBe(channelId('src2', 'http://x/1'));
  });
});
