import fs from 'fs';
import path from 'path';
import { classifyEntries } from '../classify';
import { parseM3uSync } from '../../m3u/parser';

/**
 * Acceptance fixture: http://2.24.11.112/playlist_finale.m3u
 * Source owner confirms every entry is live TV — zero films, zero series.
 * Regression: thematic groups "🎬 CINEMA & FILMS" / "📺 SÉRIES" must not
 * reclassify HLS live channels into movie/series universes.
 */
describe('playlist_finale.m3u — live-only acceptance', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'playlist_finale.m3u');
  const content = fs.readFileSync(fixturePath, 'utf8');
  const { channels } = parseM3uSync(content);

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

  it('keeps thematic cinema/series groups as live (HLS or extension-less IPTV)', () => {
    const cinema = channels.filter((c) => /films/i.test(c.groupTitle ?? ''));
    const seriesGroup = channels.filter((c) => /s[eé]ries/i.test(c.groupTitle ?? ''));

    expect(cinema.length).toBeGreaterThan(0);
    expect(seriesGroup.length).toBeGreaterThan(0);

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
