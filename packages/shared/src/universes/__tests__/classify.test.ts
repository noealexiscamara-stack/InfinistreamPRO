import { classifyEntry } from '../classify';
import type { ClassifiableEntry } from '../../content/classify';

describe('classifyEntry', () => {
  const live = (overrides: Partial<ClassifiableEntry> = {}): ClassifiableEntry => ({
    name: 'France 24',
    streamUrl: 'http://x/live.m3u8',
    groupTitle: 'News',
    ...overrides,
  });

  const vod = (overrides: Partial<ClassifiableEntry> = {}): ClassifiableEntry => ({
    name: 'Inception',
    streamUrl: 'http://x/files/title.mkv',
    groupTitle: 'Films',
    ...overrides,
  });

  it('defaults to live for a plain channel', () => {
    expect(classifyEntry(live())).toBe('live');
  });

  it('detects radio from group title even on HLS', () => {
    expect(classifyEntry(live({ groupTitle: 'Radio France', name: 'FIP' }))).toBe('radio');
  });

  it('detects radio from channel name via group', () => {
    expect(classifyEntry(live({ name: 'BBC Radio 1', groupTitle: 'UK Radio' }))).toBe('radio');
  });

  it('does not treat SxxExx on an HLS URL as a VOD series', () => {
    expect(classifyEntry(live({ name: 'Breaking Bad S01E03', groupTitle: 'Series' }))).toBe('live');
  });

  it('does not treat 1x03 on an HLS URL as a VOD series', () => {
    expect(classifyEntry(live({ name: 'Doctor Who 1x03', groupTitle: 'Sci-Fi' }))).toBe('live');
  });

  it('keeps thematic series groups as live when the URL is HLS', () => {
    expect(classifyEntry(live({ name: 'Some Show', groupTitle: 'Series TV' }))).toBe('live');
  });

  it('detects movies from VOD file + movie group', () => {
    expect(classifyEntry(vod({ name: 'Inception', groupTitle: 'Movies' }))).toBe('movie');
  });

  it('detects movies from French film group only with a VOD file URL', () => {
    expect(classifyEntry(vod({ name: 'Le Fabuleux Destin', streamUrl: 'http://x/film.mkv', groupTitle: 'Films' }))).toBe(
      'movie'
    );
  });

  it('prefers radio over movie when both keywords appear', () => {
    expect(classifyEntry(live({ name: 'Jazz Radio', groupTitle: 'Movies & Radio' }))).toBe('radio');
  });

  it('prefers episode marker over movie group for VOD files', () => {
    expect(classifyEntry(vod({ name: 'Batman S01E01', groupTitle: 'Movies' }))).toBe('series');
  });

  it('keeps news channels as live', () => {
    expect(classifyEntry(live({ name: 'CNN International', groupTitle: 'News' }))).toBe('live');
  });

  it('detects webradio groups', () => {
    expect(classifyEntry(live({ groupTitle: 'Webradio', name: 'FIP' }))).toBe('radio');
  });

  it('keeps cinema-themed live folders as live on HLS', () => {
    expect(classifyEntry(live({ groupTitle: 'Cinéma', name: 'Amélie' }))).toBe('live');
  });

  it('detects VOD groups as movies only with a VOD container URL', () => {
    expect(classifyEntry(vod({ groupTitle: 'VOD France', name: 'Taxi', streamUrl: 'http://x/taxi.mp4' }))).toBe('movie');
  });

  it('keeps saison-themed live folders as live on HLS', () => {
    expect(classifyEntry(live({ groupTitle: 'Saisons complètes', name: 'Lost' }))).toBe('live');
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
