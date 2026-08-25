import { posterGridColumns } from '@/utils/posterGrid';

describe('posterGridColumns', () => {
  it('fits more columns on tablet widths without hardcoding', () => {
    expect(posterGridColumns(360)).toBeGreaterThanOrEqual(2);
    expect(posterGridColumns(360)).toBeLessThanOrEqual(3);
    expect(posterGridColumns(800)).toBeGreaterThanOrEqual(6);
    expect(posterGridColumns(1024)).toBeGreaterThanOrEqual(7);
    expect(posterGridColumns(1280)).toBe(8);
  });
});
