import { classifyEntry, classifyEntries } from '../classify';
import type { ClassifiableEntry } from '@infiny-stream/types';

describe('classifyEntry', () => {
  const live = (overrides: Partial<ClassifiableEntry> = {}): ClassifiableEntry => ({
    name: 'France 24',
    streamUrl: 'http://x/live.m3u8',
    groupTitle: 'News',
    ...overrides,
  });

  it('defaults to live for a plain channel', () => {
    expect(classifyEntry(live())).toBe('live');
  });

  it('detects radio from group title', () => {
    expect(classifyEntry(live({ groupTitle: 'Radio France', name: 'FIP' }))).toBe('radio');
  });

  it('detects radio from channel name', () => {
    expect(classifyEntry(live({ name: 'BBC Radio 1', groupTitle: 'UK' }))).toBe('radio');
  });

  it('detects series from SxxExx in the title', () => {
    expect(classifyEntry(live({ name: 'Breaking Bad S01E03', groupTitle: 'Series' }))).toBe('series');
  });

  it('detects series from 1x03 pattern', () => {
    expect(classifyEntry(live({ name: 'Doctor Who 1x03', groupTitle: 'Sci-Fi' }))).toBe('series');
  });

  it('detects series from group when no episode marker', () => {
    expect(classifyEntry(live({ name: 'Some Show', groupTitle: 'Series TV' }))).toBe('series');
  });

  it('detects movies from VOD group', () => {
    expect(classifyEntry(live({ name: 'Inception', groupTitle: 'Movies' }))).toBe('movie');
  });

  it('detects movies from French film group', () => {
    expect(classifyEntry(live({ name: 'Le Fabuleux Destin', groupTitle: 'Films' }))).toBe('movie');
  });

  it('prefers radio over movie when both keywords appear', () => {
    expect(classifyEntry(live({ name: 'Jazz Radio', groupTitle: 'Movies & Radio' }))).toBe('radio');
  });

  it('prefers episode marker over movie group', () => {
    expect(classifyEntry(live({ name: 'Batman S01E01', groupTitle: 'Movies' }))).toBe('series');
  });

  it('keeps news channels as live', () => {
    expect(classifyEntry(live({ name: 'CNN International', groupTitle: 'News' }))).toBe('live');
  });

  it('uses category when groupTitle is missing', () => {
    expect(classifyEntry(live({ groupTitle: undefined, category: 'Films', name: 'Heat' }))).toBe('movie');
  });

  it('detects webradio groups', () => {
    expect(classifyEntry(live({ groupTitle: 'Webradio', name: 'FIP' }))).toBe('radio');
  });

  it('detects cinema groups as movies', () => {
    expect(classifyEntry(live({ groupTitle: 'Cinéma', name: 'Amélie' }))).toBe('movie');
  });

  it('detects VOD groups as movies', () => {
    expect(classifyEntry(live({ groupTitle: 'VOD France', name: 'Taxi' }))).toBe('movie');
  });

  it('detects saison keyword as series', () => {
    expect(classifyEntry(live({ groupTitle: 'Saisons complètes', name: 'Lost' }))).toBe('series');
  });

  it('uses tvgId in the haystack', () => {
    expect(classifyEntry(live({ tvgId: 'radio.france', name: 'FIP', groupTitle: 'FR' }))).toBe('radio');
  });

  it('keeps sports live channels live', () => {
    expect(classifyEntry(live({ groupTitle: 'Sports', name: 'beIN SPORTS 1' }))).toBe('live');
  });
});

describe('classifyEntries', () => {
  it('handles an empty input', () => {
    expect(classifyEntries([])).toEqual([]);
  });
  it('returns the same length as the input', () => {
    const out = classifyEntries([
      { name: 'A', streamUrl: 'http://a' },
      { name: 'B S01E01', streamUrl: 'http://b' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].kind).toBe('live');
    expect(out[1].kind).toBe('series');
  });

  it('preserves original fields', () => {
    const out = classifyEntries([{ name: 'TF1 HD', streamUrl: 'http://x', groupTitle: 'FR' }]);
    expect(out[0].name).toBe('TF1 HD');
    expect(out[0].groupTitle).toBe('FR');
  });

  it('classifies a mixed batch independently', () => {
    const out = classifyEntries([
      { name: 'NRJ', streamUrl: 'http://a', groupTitle: 'Radio' },
      { name: 'Taxi', streamUrl: 'http://b', groupTitle: 'Films' },
      { name: 'Show S01E01', streamUrl: 'http://c', groupTitle: 'Series' },
      { name: 'TF1', streamUrl: 'http://d', groupTitle: 'France' },
    ]);
    expect(out.map((x) => x.kind)).toEqual(['radio', 'movie', 'series', 'live']);
  });
});
