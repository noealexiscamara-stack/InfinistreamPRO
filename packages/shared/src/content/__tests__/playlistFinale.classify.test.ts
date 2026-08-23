import fs from 'fs';
import path from 'path';
import { classifyEntries } from '../classify';
import { parseM3uSync } from '../../m3u/parser';

/**
 * Acceptance fixture: http://2.24.11.112/playlist_finale.m3u
 * Source owner confirms every entry is live TV — zero films, zero series.
 * Smarters shows the same: 0 films, 0 series; "CINEMA & FILMS" = 128 live channels.
 */
describe('playlist_finale.m3u — live-only acceptance', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'playlist_finale.m3u');
  const content = fs.readFileSync(fixturePath, 'utf8');
  const { channels, categories } = parseM3uSync(content);

  it('parses the full playlist', () => {
    expect(channels.length).toBeGreaterThan(100);
  });

  it('classifies every entry as live (Films = 0, Séries = 0)', () => {
    const classified = classifyEntries(
      channels.map((ch) => ({
        name: ch.name,
        streamUrl: ch.streamUrl,
        groupTitle: ch.groupTitle,
      }))
    );

    expect(classified.movie).toHaveLength(0);
    expect(classified.series).toHaveLength(0);
    expect(classified.radio).toHaveLength(0);
    expect(classified.live).toHaveLength(channels.length);
  });

  it('exposes group-title as live-TV categories with expected counts', () => {
    const byName = new Map(categories.map((c) => [c.name, c.channelCount]));

    expect(byName.get('⚽ SPORT')).toBe(12);
    expect(byName.get('🇫🇷 FRANCE')).toBe(39);
    expect(byName.get('🌍 AFRIQUE FRANCOPHONE')).toBe(57);
    expect(byName.get('🎥 DOCUMENTAIRES')).toBe(15);
    expect(byName.get('🎬 CINEMA & FILMS')).toBe(128);
    expect(byName.get('📺 SÉRIES')).toBe(28);
  });

  it('keeps thematic cinema/series groups as live channels', () => {
    const cinema = channels.filter((c) => /films/i.test(c.groupTitle ?? ''));
    const seriesGroup = channels.filter((c) => /s[eé]ries/i.test(c.groupTitle ?? ''));

    expect(cinema.length).toBe(128);
    expect(seriesGroup.length).toBe(28);

    const classified = classifyEntries(
      [...cinema, ...seriesGroup].map((ch) => ({
        name: ch.name,
        streamUrl: ch.streamUrl,
        groupTitle: ch.groupTitle,
      }))
    );

    expect(classified.movie).toHaveLength(0);
    expect(classified.series).toHaveLength(0);
    expect(classified.live).toHaveLength(cinema.length + seriesGroup.length);
  });
});
