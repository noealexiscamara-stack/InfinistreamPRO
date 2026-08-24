/** Safe upper bound for chunked work — never use `fn(...hugeArray)`. */
export const ARRAY_APPEND_BATCH = 1000;

/**
 * Appends `items` onto `target` without `push(...items)`, which blows the
 * native call stack past a few tens of thousands of elements.
 */
export function appendAll<T>(target: T[], items: readonly T[]): void {
  for (let i = 0; i < items.length; i++) {
    target.push(items[i]);
  }
}

/** Yields successive slices of `items` (default 1000). */
export function* batchesOf<T>(
  items: readonly T[],
  batchSize: number = ARRAY_APPEND_BATCH
): Generator<readonly T[]> {
  const size = Math.max(1, batchSize);
  for (let i = 0; i < items.length; i += size) {
    yield items.slice(i, i + size);
  }
}
