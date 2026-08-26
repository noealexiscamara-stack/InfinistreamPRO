import {
  seriesPhaseAfterLoad,
  seriesPhaseOnFetchStart,
} from '@/app/universe/series/seriesDetailPhase';

describe('seriesDetailPhase', () => {
  it('starts in loading and never reports missing mid-fetch', () => {
    expect(seriesPhaseOnFetchStart()).toBe('loading');
  });

  it('becomes seasons when content exists', () => {
    expect(seriesPhaseAfterLoad({ found: true, seasonCount: 3 })).toBe('seasons');
  });

  it('becomes missing only after a finished empty/failed load', () => {
    expect(seriesPhaseAfterLoad({ found: false, seasonCount: 0 })).toBe('missing');
    expect(seriesPhaseAfterLoad({ found: true, seasonCount: 0 })).toBe('missing');
  });

  it('keeps loading if the effect was cancelled', () => {
    expect(seriesPhaseAfterLoad({ cancelled: true, found: false, seasonCount: 0 })).toBe('loading');
  });
});
