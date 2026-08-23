import {
  contentFitForAspectMode,
  forcedAspectRatio,
  nextPlayerAspectMode,
  playerAspectModeLabel,
} from '../playerAspectRatio';

describe('playerAspectRatio', () => {
  it('cycles through all modes', () => {
    expect(nextPlayerAspectMode('fit')).toBe('fill');
    expect(nextPlayerAspectMode('fill')).toBe('stretch');
    expect(nextPlayerAspectMode('stretch')).toBe('ratio16x9');
    expect(nextPlayerAspectMode('ratio16x9')).toBe('ratio4x3');
    expect(nextPlayerAspectMode('ratio4x3')).toBe('fit');
  });

  it('maps modes to contentFit', () => {
    expect(contentFitForAspectMode('fit')).toBe('contain');
    expect(contentFitForAspectMode('fill')).toBe('cover');
    expect(contentFitForAspectMode('stretch')).toBe('fill');
    expect(contentFitForAspectMode('ratio16x9')).toBe('contain');
  });

  it('returns forced aspect ratios only for ratio modes', () => {
    expect(forcedAspectRatio('ratio16x9')).toBeCloseTo(16 / 9);
    expect(forcedAspectRatio('ratio4x3')).toBeCloseTo(4 / 3);
    expect(forcedAspectRatio('fit')).toBeNull();
  });

  it('labels modes in French', () => {
    expect(playerAspectModeLabel('fill')).toBe('Rempli');
    expect(playerAspectModeLabel('ratio4x3')).toBe('4:3');
  });
});
