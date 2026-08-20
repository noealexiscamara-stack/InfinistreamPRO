import { classifyEntries, classifyEntry, parseEpisodeMarker, stripEpisodeMarker } from '../classify';

const e = (name: string, streamUrl: string, groupTitle?: string) => ({ name, streamUrl, groupTitle });

describe('classifyEntry — URL path wins over everything', () => {
  it('reads the Xtream path segment', () => {
    expect(classifyEntry(e('TF1', 'http://p:8080/live/u/p/1.ts'))).toBe('live');
    expect(classifyEntry(e('Le Parrain', 'http://p:8080/movie/u/p/2.mkv'))).toBe('movie');
    expect(classifyEntry(e('Engrenages', 'http://p:8080/series/u/p/3.mkv'))).toBe('series');
  });

  it('trusts the path over a contradicting group title', () => {
    expect(classifyEntry(e('Canal+ Cinéma', 'http://p:8080/live/u/p/9.ts', 'CINEMA'))).toBe('live');
    expect(classifyEntry(e('Ciné+', 'http://p:8080/live/u/p/9.ts', 'FILMS'))).toBe('live');
  });

  it('recognises an episode filed under /movie/ by the provider', () => {
    expect(classifyEntry(e('Breaking Bad S01E02', 'http://p:8080/movie/u/p/7.mkv', 'FILMS'))).toBe('series');
  });
});

describe('classifyEntry — file extension', () => {
  it('treats audio streams as radio', () => {
    expect(classifyEntry(e('RFI', 'http://x/stream.mp3'))).toBe('radio');
    expect(classifyEntry(e('Africa Radio', 'http://x/s.aac'))).toBe('radio');
  });

  it('treats on-demand video containers as movies', () => {
    expect(classifyEntry(e('Inception', 'http://x/files/inception.mp4'))).toBe('movie');
    expect(classifyEntry(e('Le Havre', 'http://x/files/lh.mkv'))).toBe('movie');
  });

  it('leaves live container formats alone', () => {
    expect(classifyEntry(e('France 2', 'http://x/f2.m3u8'))).toBe('live');
    expect(classifyEntry(e('M6', 'http://x/m6.ts'))).toBe('live');
  });
});

describe('classifyEntry — group title', () => {
  it.each([
    ['FR | RADIOS', 'radio'],
    ['Radio', 'radio'],
  ])('reads %s as %s', (group, expected) => {
    expect(classifyEntry(e('Quelque chose', 'http://x/unknown', group))).toBe(expected);
  });

  it('does not trust film/series groups alone without a VOD file or path', () => {
    expect(classifyEntry(e('Quelque chose', 'http://x/unknown', 'VOD - FILMS'))).toBe('live');
    expect(classifyEntry(e('Quelque chose', 'http://x/unknown', 'SÉRIES FR'))).toBe('live');
    expect(classifyEntry(e('Quelque chose', 'http://x/unknown', 'Novelas'))).toBe('live');
    expect(classifyEntry(e('Quelque chose', 'http://x/unknown', 'Peliculas'))).toBe('live');
  });

  it('still classifies VOD containers via extension, regardless of group', () => {
    expect(classifyEntry(e('Inception', 'http://x/files/inception.mkv', 'FILMS'))).toBe('movie');
    expect(classifyEntry(e('Show S01E02', 'http://x/files/ep.mkv', 'SERIES'))).toBe('series');
  });

  it('ignores thematic film/series groups on HLS and extension-less live URLs', () => {
    expect(classifyEntry(e('Canal+ Cinéma', 'http://x/canal.m3u8', '🎬 CINEMA & FILMS'))).toBe('live');
    expect(classifyEntry(e('Serie Max', 'http://x/series.m3u8', '📺 SÉRIES'))).toBe('live');
    expect(classifyEntry(e('AMC', 'http://x/amc.ts', 'Films'))).toBe('live');
    expect(classifyEntry(e('Nickelodeon (576p)', 'http://195.64.140.147:10121/121', '🎬 CINEMA & FILMS'))).toBe(
      'live'
    );
  });

  it('does not turn a TV channel into a radio because of the word radio', () => {
    expect(classifyEntry(e('Radio France Info TV', 'http://p:8080/live/u/p/10.ts', 'FRANCE'))).toBe('live');
    expect(classifyEntry(e('Radio Télévision Guinée', 'http://x/rtg.m3u8', 'GUINEE'))).toBe('live');
  });

  it('matches on whole words only', () => {
    expect(classifyEntry(e('Doc', 'http://x/s.m3u8', 'RADIOLOGIE'))).toBe('live');
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
    expect(stripEpisodeMarker('Engrenages Saison 3 Épisode 7')).toBe('Engrenages');
  });

  it('is a no-op on a name with no marker', () => {
    expect(stripEpisodeMarker('Inception')).toBe('Inception');
  });
});

describe('classifyEntries', () => {
  it('splits a mixed playlist without losing anything', () => {
    const entries = [
      e('TF1', 'http://p:8080/live/u/p/1.ts', 'FRANCE'),
      e('Le Parrain', 'http://p:8080/movie/u/p/2.mkv', 'FILMS'),
      e('Breaking Bad S01E01', 'http://p:8080/series/u/p/3.mkv', 'SERIES'),
      e('Breaking Bad S01E02', 'http://p:8080/series/u/p/4.mkv', 'SERIES'),
      e('RFI', 'http://x/rfi.mp3', 'RADIOS'),
      e('Inconnue', 'http://x/mystery'),
    ];
    const out = classifyEntries(entries);

    expect(out.live.map((c) => c.name)).toEqual(['TF1', 'Inconnue']);
    expect(out.movie).toHaveLength(1);
    expect(out.series).toHaveLength(2);
    expect(out.radio).toHaveLength(1);

    const total = out.live.length + out.movie.length + out.series.length + out.radio.length;
    expect(total).toBe(entries.length);
  });

  it('preserves playlist order within each universe', () => {
    const out = classifyEntries([
      e('A', 'http://p/live/u/p/1.ts'),
      e('B', 'http://p/live/u/p/2.ts'),
      e('C', 'http://p/live/u/p/3.ts'),
    ]);
    expect(out.live.map((c) => c.name)).toEqual(['A', 'B', 'C']);
  });
});
