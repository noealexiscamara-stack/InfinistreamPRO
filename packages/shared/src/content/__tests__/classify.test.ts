import { classifyEntries, classifyEntry, parseEpisodeMarker, stripEpisodeMarker } from '../classify';

const e = (name: string, streamUrl: string, groupTitle?: string) => ({ name, streamUrl, groupTitle });

describe('classifyEntry — M3U: everything live except audio', () => {
  it('classifies HLS/TS/extension-less URLs as live regardless of group', () => {
    expect(classifyEntry(e('Canal+ Cinéma', 'http://x/canal.m3u8', '🎬 CINEMA & FILMS'))).toBe('live');
    expect(classifyEntry(e('Serie Max', 'http://x/series.m3u8', '📺 SÉRIES'))).toBe('live');
    expect(classifyEntry(e('Breaking Bad S01E02', 'http://x/bb.m3u8', 'SÉRIES'))).toBe('live');
    expect(classifyEntry(e('Kaamelott 1x05', 'http://x/k.m3u8', 'SÉRIES'))).toBe('live');
    expect(classifyEntry(e('Nickelodeon', 'http://195.64.140.147:10121/121', '🎬 CINEMA & FILMS'))).toBe('live');
  });

  it('does not infer movie/series from group title alone', () => {
    expect(classifyEntry(e('Taxi', 'http://x/stream', 'VOD - FILMS'))).toBe('live');
    expect(classifyEntry(e('Lost', 'http://x/stream', 'Saisons complètes'))).toBe('live');
    expect(classifyEntry(e('FIP', 'http://x/stream', 'Radio France'))).toBe('live');
    expect(classifyEntry(e('Amélie', 'http://x/stream', 'Cinéma'))).toBe('live');
  });

  it('does not infer movie/series from VOD file extension on plain URLs', () => {
    expect(classifyEntry(e('Inception', 'http://x/files/inception.mp4', 'FILMS'))).toBe('live');
    expect(classifyEntry(e('Show S01E02', 'http://x/files/ep.mkv', 'SERIES'))).toBe('live');
  });

  it('classifies audio extensions as radio', () => {
    expect(classifyEntry(e('RFI', 'http://x/stream.mp3', 'FRANCE'))).toBe('radio');
    expect(classifyEntry(e('Africa Radio', 'http://x/s.aac'))).toBe('radio');
  });
});

describe('classifyEntry — Xtream path segments', () => {
  it('reads the Xtream path segment', () => {
    expect(classifyEntry(e('TF1', 'http://p:8080/live/u/p/1.ts'))).toBe('live');
    expect(classifyEntry(e('Le Parrain', 'http://p:8080/movie/u/p/2.mkv'))).toBe('movie');
    expect(classifyEntry(e('Engrenages', 'http://p:8080/series/u/p/3.mkv'))).toBe('series');
  });

  it('trusts the path over a contradicting group title', () => {
    expect(classifyEntry(e('Canal+ Cinéma', 'http://p:8080/live/u/p/9.ts', 'CINEMA'))).toBe('live');
  });

  it('recognises an episode filed under /movie/ by the provider', () => {
    expect(classifyEntry(e('Breaking Bad S01E02', 'http://p:8080/movie/u/p/7.mkv', 'FILMS'))).toBe('series');
  });
});

describe('classifyEntry — the safe default', () => {
  it('keeps an unclassifiable entry in Live rather than hiding it', () => {
    expect(classifyEntry(e('Chaîne inconnue', 'http://x/stream'))).toBe('live');
    expect(classifyEntry(e('Sans groupe', 'pas-une-url'))).toBe('live');
  });
});

describe('parseEpisodeMarker', () => {
  it.each([
    ['Breaking Bad S01E02', 1, 2],
    ['The Wire S1 E3', 1, 3],
    ['Kaamelott 1x05', 1, 5],
    ['Engrenages Saison 3 Épisode 7', 3, 7],
    ['Dark Season 2 Episode 8', 2, 8],
    ['Show S01X04', 1, 4],
  ])('reads %s', (name, season, episode) => {
    expect(parseEpisodeMarker(name)).toEqual({ season, episode });
  });

  it('does not invent an episode out of a year or a resolution', () => {
    expect(parseEpisodeMarker('Un film 2024')).toBeNull();
    expect(parseEpisodeMarker('Documentaire 1080p')).toBeNull();
    expect(parseEpisodeMarker('Match PSG - OM')).toBeNull();
  });
});

describe('stripEpisodeMarker', () => {
  it('leaves the series title alone', () => {
    expect(stripEpisodeMarker('Breaking Bad S01E02')).toBe('Breaking Bad');
    expect(stripEpisodeMarker('Kaamelott 1x05')).toBe('Kaamelott');
  });

  it('is a no-op on a name with no marker', () => {
    expect(stripEpisodeMarker('Inception')).toBe('Inception');
  });
});

describe('classifyEntries', () => {
  it('splits a mixed Xtream playlist without losing anything', () => {
    const entries = [
      e('TF1', 'http://p:8080/live/u/p/1.ts', 'FRANCE'),
      e('Le Parrain', 'http://p:8080/movie/u/p/2.mkv', 'FILMS'),
      e('Breaking Bad S01E01', 'http://p:8080/series/u/p/3.mkv', 'SERIES'),
      e('RFI', 'http://x/rfi.mp3', 'RADIOS'),
      e('M6', 'http://x/m6.m3u8', 'FRANCE'),
    ];
    const out = classifyEntries(entries);

    expect(out.live.map((c) => c.name)).toEqual(['TF1', 'M6']);
    expect(out.movie).toHaveLength(1);
    expect(out.series).toHaveLength(1);
    expect(out.radio).toHaveLength(1);

    const total = out.live.length + out.movie.length + out.series.length + out.radio.length;
    expect(total).toBe(entries.length);
  });
});
