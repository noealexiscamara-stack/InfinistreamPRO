import { isAdultCategoryName } from '@/utils/adultCategory';

describe('isAdultCategoryName', () => {
  it('matches known markers case- and accent-insensitively', () => {
    expect(isAdultCategoryName('FR | XXX')).toBe(true);
    expect(isAdultCategoryName('adult movies')).toBe(true);
    expect(isAdultCategoryName('ADULTÉ')).toBe(true);
    expect(isAdultCategoryName('EN - PORN')).toBe(true);
    expect(isAdultCategoryName('Erotic')).toBe(true);
    expect(isAdultCategoryName('18+ Films')).toBe(true);
    expect(isAdultCategoryName('FOR ADULTS')).toBe(true);
  });

  it('does not flag ordinary categories or titles', () => {
    expect(isAdultCategoryName('FR | ACTION')).toBe(false);
    expect(isAdultCategoryName('Inception')).toBe(false);
    expect(isAdultCategoryName(undefined)).toBe(false);
  });
});
