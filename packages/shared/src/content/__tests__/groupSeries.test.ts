import { groupEpisodesIntoSeries, type GroupSeriesInput } from '../groupSeries';

let seq = 0;
const ep = (name: string, url?: string, extra: Partial<GroupSeriesInput> = {}): GroupSeriesInput => ({
  name,
  streamUrl: url ?? `http://p/series/u/p/${seq}.mkv`,
  sourceId: 'src1',
  sortIndex: seq++,
  ...extra,
});

beforeEach(() => {
  seq = 0;
});

describe('groupEpisodesIntoSeries', () => {
  it('collapses hundreds of rows into one browsable series', () => {
    const { series } = groupEpisodesIntoSeries([
      ep('Breaking Bad S01E01'),
      ep('Breaking Bad S01E02'),
      ep('Breaking Bad S02E01'),
    ]);

    expect(series).toHaveLength(1);
    expect(series[0].name).toBe('Breaking Bad');
    expect(series[0].episodes).toHaveLength(3);
    expect(series[0].seasons).toEqual([1, 2]);
  });

  it('orders episodes by season then episode, whatever the playlist order', () => {
    const { series } = groupEpisodesIntoSeries([
      ep('Dark S02E03'),
      ep('Dark S01E10'),
      ep('Dark S01E02'),
      ep('Dark S02E01'),
    ]);

    expect(series[0].episodes.map((e) => `${e.season}x${e.episode}`)).toEqual(['1x2', '1x10', '2x1', '2x3']);
  });

  it('does not split one show over casing or accents', () => {
    const { series } = groupEpisodesIntoSeries([
      ep('Engrenages S01E01'),
      ep('ENGRENAGES S01E02'),
      ep('Engrenages S01E03'),
    ]);
    expect(series).toHaveLength(1);
    expect(series[0].episodes).toHaveLength(3);
  });

  it('keeps genuinely different shows apart', () => {
    const { series } = groupEpisodesIntoSeries([ep('Dark S01E01'), ep('Darknet S01E01')]);
    expect(series).toHaveLength(2);
  });

  it('extracts an episode title when the source gives one', () => {
    const { series } = groupEpisodesIntoSeries([ep("Breaking Bad S01E02 - Cat's in the Bag")]);
    expect(series[0].name).toBe('Breaking Bad');
    expect(series[0].episodes[0].title).toBe("Cat's in the Bag");
  });

  it('leaves the episode title empty when the name is just the marker', () => {
    const { series } = groupEpisodesIntoSeries([ep('Breaking Bad S01E02')]);
    expect(series[0].episodes[0].title).toBeUndefined();
  });

  it('returns entries with no readable marker instead of dropping them', () => {
    const { series, unparsed } = groupEpisodesIntoSeries([
      ep('Breaking Bad S01E01'),
      ep('Un documentaire sans marqueur'),
    ]);

    expect(series).toHaveLength(1);
    expect(unparsed).toHaveLength(1);
    expect(unparsed[0].name).toBe('Un documentaire sans marqueur');
  });

  it('never loses an entry', () => {
    const input = [
      ep('Dark S01E01'),
      ep('Dark S01E02'),
      ep('Sans marqueur'),
      ep('Kaamelott 1x01'),
    ];
    const { series, unparsed } = groupEpisodesIntoSeries(input);
    const kept = series.reduce((n, s) => n + s.episodes.length, 0) + unparsed.length;
    expect(kept).toBe(input.length);
  });

  it('drops a duplicated stream URL rather than emitting a clashing id', () => {
    const { series } = groupEpisodesIntoSeries([
      ep('Dark S01E01', 'http://p/series/u/p/same.mkv'),
      ep('Dark S01E01', 'http://p/series/u/p/same.mkv'),
    ]);
    expect(series[0].episodes).toHaveLength(1);
  });

  it('gives every episode across a series a distinct id', () => {
    const { series } = groupEpisodesIntoSeries([
      ep('Dark S01E01'),
      ep('Dark S01E02'),
      ep('Dark S02E01'),
    ]);
    const ids = series[0].episodes.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('produces a stable series id across runs', () => {
    const a = groupEpisodesIntoSeries([ep('Dark S01E01')]).series[0].id;
    seq = 0;
    const b = groupEpisodesIntoSeries([ep('Dark S01E01')]).series[0].id;
    expect(a).toBe(b);
  });

  it('orders series by where they first appeared in the playlist', () => {
    const { series } = groupEpisodesIntoSeries([
      ep('Zeta S01E01'),
      ep('Alpha S01E01'),
      ep('Zeta S01E02'),
    ]);
    expect(series.map((s) => s.name)).toEqual(['Zeta', 'Alpha']);
  });

  it('handles an empty input', () => {
    expect(groupEpisodesIntoSeries([])).toEqual({ series: [], unparsed: [] });
  });
});
