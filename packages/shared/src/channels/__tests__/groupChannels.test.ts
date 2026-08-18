import type { Channel } from '@infiny-stream/types';
import { groupChannelsByQuality, nominalKbpsFor, selectStartingTier } from '../groupChannels';

let seq = 0;
function ch(name: string, extra: Partial<Channel> = {}): Channel {
  const index = seq++;
  return {
    id: `id${index}`,
    sourceId: 'src1',
    name,
    streamUrl: extra.streamUrl ?? `http://provider/${encodeURIComponent(name)}.m3u8`,
    sortIndex: extra.sortIndex ?? index,
    ...extra,
  };
}

beforeEach(() => {
  seq = 0;
});

describe('groupChannelsByQuality', () => {
  it('rebuilds a ladder from separately-listed quality variants', () => {
    const { groups, laddersFound } = groupChannelsByQuality([ch('TF1 SD'), ch('TF1 HD'), ch('TF1 FHD')]);

    expect(groups).toHaveLength(1);
    expect(laddersFound).toBe(1);
    expect(groups[0].name).toBe('TF1');
    expect(groups[0].hasLadder).toBe(true);
    expect(groups[0].tiers.map((t) => t.label)).toEqual(['SD', 'HD', 'FHD']);
  });

  it('orders tiers lowest-quality-first regardless of playlist order', () => {
    const { groups } = groupChannelsByQuality([ch('M6 FHD'), ch('M6 SD'), ch('M6 HD')]);
    expect(groups[0].tiers.map((t) => t.rank)).toEqual([1, 2, 3]);
  });

  it('sorts an unmarked entry to the bottom — we do not know what it is', () => {
    const { groups } = groupChannelsByQuality([ch('France 2 HD'), ch('France 2')]);
    expect(groups[0].tiers.map((t) => t.label)).toEqual(['', 'HD']);
  });

  // --- the invariant that matters most -----------------------------------

  it('never loses a channel', () => {
    const input = [
      ch('TF1 SD'),
      ch('TF1 HD'),
      ch('HDNet'),
      ch('Discovery HD Showcase'),
      ch('beIN Sports 1 HD'),
      ch('beIN Sports 2 HD'),
      ch('Canal+ Sport 360'),
      ch('M6'),
    ];
    const { groups, duplicatesRemoved } = groupChannelsByQuality(input);

    const totalTiers = groups.reduce((n, g) => n + g.tiers.length, 0);
    expect(totalTiers + duplicatesRemoved).toBe(input.length);

    const urls = new Set(groups.flatMap((g) => g.tiers.map((t) => t.channel.streamUrl)));
    for (const c of input) expect(urls.has(c.streamUrl)).toBe(true);
  });

  it('keeps channels apart when only the quality suffix would have merged them', () => {
    const { groups } = groupChannelsByQuality([ch('TF1 HD'), ch('TF1 Séries Films HD')]);
    expect(groups).toHaveLength(2);
  });

  it('keeps numbered siblings apart', () => {
    const { groups } = groupChannelsByQuality([ch('beIN Sports 1 HD'), ch('beIN Sports 2 HD')]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.hasLadder === false)).toBe(true);
  });

  it('does not group a lone channel into a fake ladder', () => {
    const { groups, laddersFound } = groupChannelsByQuality([ch('M6')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].tiers).toHaveLength(1);
    expect(groups[0].hasLadder).toBe(false);
    expect(laddersFound).toBe(0);
  });

  // --- tvg-id handling ----------------------------------------------------

  it('splits same-named entries that carry different tvg-ids', () => {
    const { groups } = groupChannelsByQuality([
      ch('TF1 HD', { tvgId: 'TF1.fr' }),
      ch('TF1 SD', { tvgId: 'TF1.fr' }),
      ch('TF1 HD', { tvgId: 'TF1.be', streamUrl: 'http://provider/be-tf1-hd' }),
    ]);

    expect(groups).toHaveLength(2);
    const fr = groups.find((g) => g.tvgId === 'TF1.fr');
    expect(fr?.tiers).toHaveLength(2);
  });

  it('lets an untagged entry join the single known tvg-id of its name group', () => {
    const { groups } = groupChannelsByQuality([ch('TF1 HD', { tvgId: 'TF1.fr' }), ch('TF1 SD')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].tiers).toHaveLength(2);
  });

  it('does not guess when a name group has several tvg-ids', () => {
    const { groups } = groupChannelsByQuality([
      ch('TF1 HD', { tvgId: 'TF1.fr' }),
      ch('TF1 HD', { tvgId: 'TF1.be', streamUrl: 'http://provider/be' }),
      ch('TF1 SD'),
    ]);
    // fr, be, and the untagged one — kept separate rather than mis-attached.
    expect(groups).toHaveLength(3);
  });

  // --- resilience ---------------------------------------------------------

  it('keeps two entries at the same rank as backup URLs', () => {
    const { groups } = groupChannelsByQuality([
      ch('TF1 HD', { streamUrl: 'http://server-a/tf1' }),
      ch('TF1 HD', { streamUrl: 'http://server-b/tf1' }),
    ]);
    expect(groups[0].tiers).toHaveLength(2);
    expect(groups[0].hasLadder).toBe(false);
  });

  it('drops an exact duplicate url and reports it', () => {
    const { groups, duplicatesRemoved } = groupChannelsByQuality([
      ch('TF1 HD', { streamUrl: 'http://same/tf1' }),
      ch('TF1 HD', { streamUrl: 'http://same/tf1' }),
    ]);
    expect(groups[0].tiers).toHaveLength(1);
    expect(duplicatesRemoved).toBe(1);
  });

  it('produces a stable id across runs', () => {
    const a = groupChannelsByQuality([ch('TF1 SD'), ch('TF1 HD')]).groups[0].id;
    seq = 0;
    const b = groupChannelsByQuality([ch('TF1 SD'), ch('TF1 HD')]).groups[0].id;
    expect(a).toBe(b);
  });

  it('preserves playlist order via sortIndex', () => {
    const { groups } = groupChannelsByQuality([
      ch('Zeta', { sortIndex: 5 }),
      ch('Alpha HD', { sortIndex: 1 }),
      ch('Alpha SD', { sortIndex: 9 }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('carries over a logo from whichever tier has one', () => {
    const { groups } = groupChannelsByQuality([
      ch('TF1 SD'),
      ch('TF1 HD', { logoUrl: 'http://logo/tf1.png' }),
    ]);
    expect(groups[0].logoUrl).toBe('http://logo/tf1.png');
  });
});

describe('selectStartingTier', () => {
  const group = groupChannelsByQuality([ch('TF1 SD'), ch('TF1 HD'), ch('TF1 FHD')]).groups[0];

  it('starts at the bottom when the network is unknown', () => {
    expect(selectStartingTier(group, undefined).label).toBe('SD');
  });

  it('starts at the bottom on a weak connection', () => {
    expect(selectStartingTier(group, 300).label).toBe('SD');
  });

  it('stays one rung below what the link could afford, to leave headroom', () => {
    // Comfortably enough for FHD; still opens on HD so the first move is up.
    expect(selectStartingTier(group, 20_000).label).toBe('HD');
  });

  it('respects the quality-mode cap', () => {
    expect(selectStartingTier(group, 20_000, 480).label).toBe('SD');
  });

  it('never returns nothing when every tier exceeds the cap', () => {
    const uhdOnly = groupChannelsByQuality([ch('Sport 4K')]).groups[0];
    expect(selectStartingTier(uhdOnly, 50_000, 480)).toBeDefined();
  });
});

describe('nominalKbpsFor', () => {
  it('increases monotonically with resolution', () => {
    const heights = [360, 480, 576, 720, 1080, 1440, 2160, 4320];
    const values = heights.map(nominalKbpsFor);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
  });
});
