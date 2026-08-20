import { classifyEntry, classifyEntries, tagEntriesWithKind } from '../classify';

describe('classifyEntries', () => {
  it('handles an empty input', () => {
    expect(classifyEntries([])).toEqual({ live: [], movie: [], series: [], radio: [] });
  });

  it('returns the same length as the input', () => {
    const tagged = tagEntriesWithKind([
      { name: 'A', streamUrl: 'http://a' },
      { name: 'B S01E01', streamUrl: 'http://b/ep.mkv' },
    ]);
    expect(tagged).toHaveLength(2);
    expect(tagged[0].kind).toBe('live');
    expect(tagged[1].kind).toBe('series');
  });

  it('preserves original fields', () => {
    const tagged = tagEntriesWithKind([{ name: 'TF1 HD', streamUrl: 'http://x', groupTitle: 'FR' }]);
    expect(tagged[0].name).toBe('TF1 HD');
    expect(tagged[0].groupTitle).toBe('FR');
  });

  it('classifies a mixed batch independently', () => {
    const buckets = classifyEntries([
      { name: 'NRJ', streamUrl: 'http://a', groupTitle: 'Radio' },
      { name: 'Taxi', streamUrl: 'http://b/taxi.mkv', groupTitle: 'Films' },
      { name: 'Show S01E01', streamUrl: 'http://c/ep.mkv', groupTitle: 'Series' },
      { name: 'TF1', streamUrl: 'http://d', groupTitle: 'France' },
    ]);
    expect(buckets.radio).toHaveLength(1);
    expect(buckets.movie).toHaveLength(1);
    expect(buckets.series).toHaveLength(1);
    expect(buckets.live).toHaveLength(1);
  });

  it('does not invent VOD from thematic groups on extension-less URLs', () => {
    expect(classifyEntry({ name: 'Taxi', streamUrl: 'http://b', groupTitle: 'Films' })).toBe('live');
    expect(classifyEntry({ name: 'Show', streamUrl: 'http://c', groupTitle: 'Series' })).toBe('live');
  });
});
