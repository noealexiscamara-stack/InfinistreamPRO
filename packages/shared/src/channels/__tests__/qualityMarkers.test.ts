import { channelNameKey, stripQualityMarker } from '../qualityMarkers';

describe('stripQualityMarker', () => {
  it.each([
    ['TF1 HD', 'TF1', 'HD', 2],
    ['TF1 FHD', 'TF1', 'FHD', 3],
    ['TF1 SD', 'TF1', 'SD', 1],
    ['TF1 4K', 'TF1', 'UHD', 5],
    ['TF1 UHD', 'TF1', 'UHD', 5],
    ['TF1 FULL HD', 'TF1', 'FHD', 3],
    ['TF1 ULTRA HD', 'TF1', 'UHD', 5],
    ['TF1 1080p', 'TF1', 'FHD', 3],
    ['TF1 720p', 'TF1', 'HD', 2],
    ['TF1 480p', 'TF1', 'SD', 1],
    ['TF1 HD+', 'TF1', 'HD', 2],
    ['Al Jazeera LQ', 'Al Jazeera', 'SD', 1],
  ])('reads the trailing marker on %s', (input, baseName, label, rank) => {
    const result = stripQualityMarker(input);
    expect(result.baseName).toBe(baseName);
    expect(result.marker.label).toBe(label);
    expect(result.marker.rank).toBe(rank);
  });

  it.each([
    ['[HD] TF1', 'TF1', 'HD'],
    ['TF1 (FHD)', 'TF1', 'FHD'],
    ['TF1 {4K}', 'TF1', 'UHD'],
  ])('reads a bracketed marker anywhere: %s', (input, baseName, label) => {
    const result = stripQualityMarker(input);
    expect(result.baseName).toBe(baseName);
    expect(result.marker.label).toBe(label);
  });

  it.each([['TF1 - HD'], ['TF1|HD'], ['TF1_HD'], ['TF1.HD'], ['TF1 : HD']])(
    'tolerates the separator in %s and leaves no dangling punctuation',
    (input) => {
      expect(stripQualityMarker(input).baseName).toBe('TF1');
    },
  );

  it('collapses a doubled-up suffix and keeps the highest marker', () => {
    const result = stripQualityMarker('TF1 FHD 1080p');
    expect(result.baseName).toBe('TF1');
    expect(result.marker.label).toBe('FHD');
  });

  // --- the false-positive traps: these must NOT be stripped ---------------

  it('leaves HD alone when it is part of the word', () => {
    expect(stripQualityMarker('HDNet').baseName).toBe('HDNet');
    expect(stripQualityMarker('HDNet').marker.rank).toBe(0);
  });

  it('leaves a mid-name HD alone — it belongs to the channel identity', () => {
    const result = stripQualityMarker('Discovery HD Showcase');
    expect(result.baseName).toBe('Discovery HD Showcase');
    expect(result.marker.rank).toBe(0);
  });

  it('never reduces a name to nothing', () => {
    expect(stripQualityMarker('HD').baseName).toBe('HD');
    expect(stripQualityMarker('4K').baseName).toBe('4K');
  });

  it('does not treat a bare number as a resolution', () => {
    expect(stripQualityMarker('Canal+ Sport 360').baseName).toBe('Canal+ Sport 360');
    expect(stripQualityMarker('beIN Sports 1').baseName).toBe('beIN Sports 1');
    expect(stripQualityMarker('RMC Sport 2').baseName).toBe('RMC Sport 2');
  });

  it('returns rank 0 for an unmarked name', () => {
    expect(stripQualityMarker('TV5 Monde').marker.rank).toBe(0);
    expect(stripQualityMarker('M6').marker.rank).toBe(0);
  });
});

describe('channelNameKey', () => {
  it('ignores case, punctuation and diacritics', () => {
    expect(channelNameKey('Canal+ Sport')).toBe(channelNameKey('CANAL + SPORT'));
    expect(channelNameKey('Télé Monde')).toBe(channelNameKey('Tele Monde'));
  });

  it('keeps genuinely different channels apart', () => {
    expect(channelNameKey('beIN Sports 1')).not.toBe(channelNameKey('beIN Sports 2'));
    expect(channelNameKey('TF1')).not.toBe(channelNameKey('TF1 Séries Films'));
    expect(channelNameKey('TF1')).not.toBe(channelNameKey('HDNet'));
  });
});
