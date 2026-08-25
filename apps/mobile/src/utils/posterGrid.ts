/**
 * Responsive poster grid columns from viewport width — never hardcode
 * a column count. Targets ~6–8 posters on tablets, 2–3 on phones.
 */
export function posterGridColumns(width: number, options?: { minTile?: number; maxColumns?: number }): number {
  const minTile = options?.minTile ?? 110;
  const maxColumns = options?.maxColumns ?? 8;
  const horizontalPad = 32; // ~ spacing.md * 2
  const gap = 8;
  const usable = Math.max(width - horizontalPad, minTile);
  const columns = Math.floor((usable + gap) / (minTile + gap));
  return Math.max(2, Math.min(maxColumns, columns));
}

export function posterTileWidth(width: number, numColumns: number, gap = 8, horizontalPad = 32): number {
  return (width - horizontalPad - gap * (numColumns - 1)) / numColumns;
}
