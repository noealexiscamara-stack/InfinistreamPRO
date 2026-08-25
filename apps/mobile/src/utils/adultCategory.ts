/**
 * Adult category detection from category_name only (never from title).
 * Case- and accent-insensitive.
 */
const ADULT_PATTERNS: RegExp[] = [
  /\bXXX\b/,
  /\bADULTS?\b/,
  /\bADULTE?S?\b/,
  /\bPORN(?:O|OGRAPHY)?\b/,
  /\bEROTIC(?:A|S)?\b/,
  /\b18\s*\+/,
  /\bFOR\s+ADULTS?\b/,
];

export function normalizeCategoryLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when category_name matches known adult markers. */
export function isAdultCategoryName(categoryName: string | undefined | null): boolean {
  if (!categoryName) return false;
  const normalized = normalizeCategoryLabel(categoryName);
  if (!normalized) return false;
  return ADULT_PATTERNS.some((re) => re.test(normalized));
}

export function categoryRowId(sourceId: string, kind: string, name: string): string {
  return `${sourceId}::${kind}::${name}`;
}
