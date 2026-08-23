import { classifyEntry, classifyEntries, tagEntriesWithKind } from '../classify';

describe('classifyEntries', () => {
  it('handles an empty input', () => {
    expect(classifyEntries([])).toEqual({ live: [], movie: [], series: [], radio: [] });
  });

  it('tags M3U entries as live by default', () => {
    const tagged = tagEntriesWithKind([
      { name: 'A', streamUrl: 'http://a/stream.m3u8' },
      { name: 'B S01E01', streamUrl: 'http://b/ep.m3u8', groupTitle: 'SÉRIES' },
    ]);
    expect(tagged).toHaveLength(2);
    expect(tagged[0].kind).toBe('live');
    expect(tagged[1].kind).toBe('live');
  });

  it('preserves original fields', () => {
    const tagged = tagEntriesWithKind([{ name: 'TF1 HD', streamUrl: 'http://x', groupTitle: 'FR' }]);
    expect(tagged[0].name).toBe('TF1 HD');
    expect(tagged[0].groupTitle).toBe('FR');
  });

  it('classifies a mixed M3U batch as live except audio', () => {
    const buckets = classifyEntries([
      { name: 'NRJ', streamUrl: 'http://a/nrj.mp3', groupTitle: 'Radio' },
      { name: 'Taxi', streamUrl: 'http://b/taxi.m3u8', groupTitle: 'Films' },
      { name: 'Show S01E01', streamUrl: 'http://c/show.m3u8', groupTitle: 'Series' },
      { name: 'TF1', streamUrl: 'http://d/tf1.m3u8', groupTitle: 'France' },
    ]);
    expect(buckets.radio).toHaveLength(1);
    expect(buckets.movie).toHaveLength(0);
    expect(buckets.series).toHaveLength(0);
    expect(buckets.live).toHaveLength(3);
  });

  it('does not invent VOD from thematic groups', () => {
    expect(classifyEntry({ name: 'Taxi', streamUrl: 'http://b', groupTitle: 'Films' })).toBe('live');
    expect(classifyEntry({ name: 'Show', streamUrl: 'http://c', groupTitle: 'Series' })).toBe('live');
  });
});
