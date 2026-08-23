import { classifyEntry } from '../classify';
import type { ClassifiableEntry } from '../../content/classify';

describe('classifyEntry', () => {
  const live = (overrides: Partial<ClassifiableEntry> = {}): ClassifiableEntry => ({
    name: 'France 24',
    streamUrl: 'http://x/live.m3u8',
    groupTitle: 'News',
    ...overrides,
  });

  const xtreamMovie = (overrides: Partial<ClassifiableEntry> = {}): ClassifiableEntry => ({
    name: 'Inception',
    streamUrl: 'http://p:8080/movie/u/p/2.mkv',
    groupTitle: 'Films',
    ...overrides,
  });

  it('defaults M3U entries to live', () => {
    expect(classifyEntry(live())).toBe('live');
  });

  it('does not infer radio from group title on HLS', () => {
    expect(classifyEntry(live({ groupTitle: 'Radio France', name: 'FIP' }))).toBe('live');
    expect(classifyEntry(live({ groupTitle: 'Webradio', name: 'FIP' }))).toBe('live');
  });

  it('classifies audio extension as radio', () => {
    expect(classifyEntry(live({ name: 'FIP', streamUrl: 'http://x/fip.mp3' }))).toBe('radio');
  });

  it('does not treat SxxExx on an HLS URL as a VOD series', () => {
    expect(classifyEntry(live({ name: 'Breaking Bad S01E03', groupTitle: 'Series' }))).toBe('live');
  });

  it('keeps thematic cinema/series groups as live on M3U', () => {
    expect(classifyEntry(live({ groupTitle: 'Cinéma', name: 'Amélie' }))).toBe('live');
    expect(classifyEntry(live({ groupTitle: 'Saisons complètes', name: 'Lost' }))).toBe('live');
    expect(classifyEntry(live({ groupTitle: 'Series TV', name: 'Some Show' }))).toBe('live');
  });

  it('detects movies from Xtream /movie/ path', () => {
    expect(classifyEntry(xtreamMovie())).toBe('movie');
  });

  it('promotes Xtream /movie/ with episode marker to series', () => {
    expect(classifyEntry(xtreamMovie({ name: 'Batman S01E01' }))).toBe('series');
  });

  it('trusts /live/ over a radio-looking name', () => {
    expect(
      classifyEntry(live({ name: 'Radio France Info TV', streamUrl: 'http://p:8080/live/u/p/1.ts' }))
    ).toBe('live');
  });
});
