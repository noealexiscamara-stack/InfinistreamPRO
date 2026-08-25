/**
 * Derives a language code from an Xtream category_name prefix only.
 * Never guesses from a film/series title.
 *
 * Examples: "FR | ACTION" → FR, "EN - DRAMA" → EN, "AR Movies" → AR.
 */
const PREFIX_RE = /^([A-Za-z]{2,3})\s*(?:[|:\-–—]\s*|\s+)/;

const KNOWN = new Set([
  'FR',
  'EN',
  'AR',
  'ES',
  'DE',
  'IT',
  'PT',
  'TR',
  'NL',
  'PL',
  'RU',
  'US',
  'UK',
  'BE',
  'CA',
  'AF',
]);

export const LANGUAGE_OTHER = 'Autres';

export function languageFromCategoryName(categoryName: string | undefined | null): string {
  if (!categoryName) return LANGUAGE_OTHER;
  const trimmed = categoryName.trim();
  const match = PREFIX_RE.exec(trimmed);
  if (!match) return LANGUAGE_OTHER;
  const code = match[1].toUpperCase();
  if (KNOWN.has(code)) return code;
  // Accept any 2–3 letter uppercase-looking prefix that looks like a locale tag.
  if (code.length >= 2 && code.length <= 3) return code;
  return LANGUAGE_OTHER;
}

export function groupCategoriesByLanguage<T extends { name: string }>(
  categories: T[]
): Array<{ language: string; categories: T[] }> {
  const buckets = new Map<string, T[]>();
  for (const cat of categories) {
    const lang = languageFromCategoryName(cat.name);
    const list = buckets.get(lang);
    if (list) list.push(cat);
    else buckets.set(lang, [cat]);
  }

  const languages = [...buckets.keys()].sort((a, b) => {
    if (a === LANGUAGE_OTHER) return 1;
    if (b === LANGUAGE_OTHER) return -1;
    return a.localeCompare(b, 'fr');
  });

  return languages.map((language) => ({
    language,
    categories: buckets.get(language)!,
  }));
}
