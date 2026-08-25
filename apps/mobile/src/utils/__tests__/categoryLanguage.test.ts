import { languageFromCategoryName, LANGUAGE_OTHER } from '@/utils/categoryLanguage';

describe('languageFromCategoryName', () => {
  it('reads FR/EN/AR prefixes from category_name only', () => {
    expect(languageFromCategoryName('FR | ACTION')).toBe('FR');
    expect(languageFromCategoryName('EN - DRAMA')).toBe('EN');
    expect(languageFromCategoryName('AR Movies')).toBe('AR');
  });

  it('never invents a language from an empty or free-form name', () => {
    expect(languageFromCategoryName('Action')).toBe(LANGUAGE_OTHER);
    expect(languageFromCategoryName(undefined)).toBe(LANGUAGE_OTHER);
    expect(languageFromCategoryName('Inception')).toBe(LANGUAGE_OTHER);
  });
});
