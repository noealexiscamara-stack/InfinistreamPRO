import type { Channel } from '@infiny-stream/types';
import { groupEpisodesIntoSeries, parseEpisodeName } from '../series';

function ch(partial: Partial<Channel> & Pick<Channel, 'name'>): Channel {
  const sortIndex = partial.sortIndex ?? 0;
  return {
    id: partial.id ?? `ch_${partial.name}`,
    sourceId: partial.sourceId ?? 'src1',
    streamUrl: partial.streamUrl ?? `http://x/stream/${sortIndex}/${encodeURIComponent(partial.name)}`,
    sortIndex,
    ...partial,
  };
}

describe('parseEpisodeName', () => {
  it('parses S01E03', () => {
    expect(parseEpisodeName('Breaking Bad S01E03')).toEqual({
      seriesTitle: 'Breaking Bad',
      season: 1,
      episode: 3,
    });
  });

  it('parses 2x05', () => {
    expect(parseEpisodeName('The Office 2x05')).toEqual({
      seriesTitle: 'The Office',
      season: 2,
      episode: 5,
    });
  });

  it('returns null for a movie title', () => {
    expect(parseEpisodeName('Inception')).toBeNull();
  });

  it('parses Season N Episode M', () => {
    expect(parseEpisodeName('Friends Season 2 Episode 5')).toEqual({
      seriesTitle: 'Friends',
      season: 2,
      episode: 5,
    });
  });
});

describe('groupEpisodesIntoSeries', () => {
  it('groups episodes under seasons and series', () => {
    const { series, unparsed } = groupEpisodesIntoSeries([
      ch({ name: 'Demo S01E01', sortIndex: 0 }),
      ch({ name: 'Demo S01E02', sortIndex: 1 }),
      ch({ name: 'Demo S02E01', sortIndex: 2 }),
    ]);
    expect(unparsed).toHaveLength(0);
    expect(series).toHaveLength(1);
    expect(series[0].title).toBe('Demo');
    expect(series[0].seasons).toHaveLength(2);
    expect(series[0].seasons[0].episodes).toHaveLength(2);
    expect(series[0].seasons[1].episodes).toHaveLength(1);
  });

  it('keeps unparsed series rows instead of dropping them', () => {
    const orphan = ch({ name: 'Anthology Special', sortIndex: 3 });
    const { series, unparsed } = groupEpisodesIntoSeries([
      ch({ name: 'Show S01E01' }),
      orphan,
    ]);
    expect(series).toHaveLength(1);
    expect(unparsed).toEqual([orphan]);
  });

  it('separates two different series', () => {
    const { series } = groupEpisodesIntoSeries([
      ch({ name: 'Alpha S01E01' }),
      ch({ name: 'Beta S01E01' }),
    ]);
    expect(series).toHaveLength(2);
    expect(series.map((s) => s.title).sort()).toEqual(['Alpha', 'Beta']);
  });

  it('sorts episodes within a season', () => {
    const { series } = groupEpisodesIntoSeries([
      ch({ name: 'X S01E03', sortIndex: 2 }),
      ch({ name: 'X S01E01', sortIndex: 0 }),
      ch({ name: 'X S01E02', sortIndex: 1 }),
    ]);
    const eps = series[0].seasons[0].episodes.map((e) => e.name);
    expect(eps).toEqual(['X S01E01', 'X S01E02', 'X S01E03']);
  });

  it('is stable for an empty input', () => {
    expect(groupEpisodesIntoSeries([])).toEqual({ series: [], unparsed: [] });
  });

  it('returns only unparsed when nothing matches an episode pattern', () => {
    const a = ch({ name: 'Making Of' });
    const b = ch({ name: 'Bonus' });
    expect(groupEpisodesIntoSeries([a, b])).toEqual({ series: [], unparsed: [a, b] });
  });

  it('sorts seasons ascending', () => {
    const { series } = groupEpisodesIntoSeries([
      ch({ name: 'Y S03E01' }),
      ch({ name: 'Y S01E01' }),
      ch({ name: 'Y S02E01' }),
    ]);
    expect(series[0].seasons.map((s) => s.season)).toEqual([1, 2, 3]);
  });

  it('reuses a logo from any episode in the series', () => {
    const { series } = groupEpisodesIntoSeries([
      ch({ name: 'Z S01E01', logoUrl: 'http://logo' }),
      ch({ name: 'Z S01E02' }),
    ]);
    expect(series[0].logoUrl).toBe('http://logo');
  });

  it('orders series by first playlist appearance', () => {
    const { series } = groupEpisodesIntoSeries([
      ch({ name: 'Zulu S01E01' }),
      ch({ name: 'Alpha S01E01' }),
    ]);
    expect(series.map((s) => s.title)).toEqual(['Zulu', 'Alpha']);
  });

  it('keeps distinct source ids separate even with the same title', () => {
    const { series } = groupEpisodesIntoSeries([
      ch({ name: 'Shared S01E01', sourceId: 'a' }),
      ch({ name: 'Shared S01E01', sourceId: 'b' }),
    ]);
    expect(series).toHaveLength(2);
  });

  it('uses the earliest sortIndex on the series row', () => {
    const { series } = groupEpisodesIntoSeries([
      ch({ name: 'Q S02E01', sortIndex: 50 }),
      ch({ name: 'Q S01E01', sortIndex: 5 }),
    ]);
    expect(series[0].sortIndex).toBe(5);
  });

  it('groups episodes sharing a title across providers separately per source', () => {
    const { series } = groupEpisodesIntoSeries([
      ch({ name: 'House S01E01', sourceId: 'one', sortIndex: 0 }),
      ch({ name: 'House S01E02', sourceId: 'one', sortIndex: 1 }),
      ch({ name: 'House S01E01', sourceId: 'two', sortIndex: 0 }),
    ]);
    expect(series).toHaveLength(2);
    expect(series.every((s) => s.title === 'House')).toBe(true);
  });
});
