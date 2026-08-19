import { classifyEntry } from '../classify';
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

  it('detects radio from channel name via group', () => {
    expect(classifyEntry(live({ name: 'BBC Radio 1', groupTitle: 'UK Radio' }))).toBe('radio');
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

  it('keeps sports live channels live', () => {
    expect(classifyEntry(live({ groupTitle: 'Sports', name: 'beIN SPORTS 1' }))).toBe('live');
  });

  it('trusts /live/ over a radio-looking name', () => {
    expect(
      classifyEntry(live({ name: 'Radio France Info TV', streamUrl: 'http://p:8080/live/u/p/1.ts' }))
    ).toBe('live');
  });

  it('does not read RADIOLOGIE as radio', () => {
    expect(classifyEntry(live({ groupTitle: 'RADIOLOGIE', name: 'IRM thorax' }))).toBe('live');
  });
});
