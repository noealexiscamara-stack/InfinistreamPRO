import { currentAndNextProgram, parseXmltv } from '../xmltv';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="rtg"><display-name>RTG</display-name></channel>
  <programme channel="rtg" start="20240115180000 +0000" stop="20240115190000 +0000">
    <title lang="fr">Journal du soir</title>
    <desc lang="fr">L'actualité du jour.</desc>
  </programme>
  <programme channel="rtg" start="20240115190000 +0000" stop="20240115200000 +0000">
    <title lang="fr">Météo</title>
  </programme>
  <programme channel="rtg" start="not-a-date" stop="20240115210000 +0000">
    <title lang="fr">Programme invalide</title>
  </programme>
</tv>`;

describe('parseXmltv', () => {
  it('extracts well-formed programmes', () => {
    const { programs } = parseXmltv(SAMPLE_XML);
    expect(programs).toHaveLength(2);
    expect(programs[0].title).toBe('Journal du soir');
    expect(programs[0].description).toBe("L'actualité du jour.");
  });

  it('skips malformed entries with a warning instead of throwing', () => {
    const { programs, warnings } = parseXmltv(SAMPLE_XML);
    expect(programs.find((p) => p.title === 'Programme invalide')).toBeUndefined();
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('never throws on completely invalid XML', () => {
    const { programs, warnings } = parseXmltv('not xml at all {{{');
    expect(programs).toEqual([]);
    expect(warnings.length).toBeGreaterThanOrEqual(0);
  });
});

describe('currentAndNextProgram', () => {
  it('finds the program airing now and the following one', () => {
    const { programs } = parseXmltv(SAMPLE_XML);
    const nowMs = Date.parse('2024-01-15T18:30:00Z');
    const { current, next } = currentAndNextProgram(programs, 'rtg', nowMs);
    expect(current?.title).toBe('Journal du soir');
    expect(next?.title).toBe('Météo');
  });
});
