import { dedupeChannelsByUrl } from '../dedupe';
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
