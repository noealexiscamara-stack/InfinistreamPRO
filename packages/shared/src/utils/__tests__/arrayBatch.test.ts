import { appendAll, ARRAY_APPEND_BATCH, batchesOf } from '../arrayBatch';

describe('appendAll', () => {
  it('appends every item without using spread', () => {
    const target: number[] = [1, 2];
    appendAll(target, [3, 4, 5]);
    expect(target).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles large arrays', () => {
    const target: number[] = [];
    const items = Array.from({ length: 25_000 }, (_, i) => i);
    appendAll(target, items);
    expect(target).toHaveLength(25_000);
    expect(target[0]).toBe(0);
    expect(target[24_999]).toBe(24_999);
  });
});

describe('batchesOf', () => {
  it('yields slices of the requested size', () => {
    const batches = [...batchesOf([1, 2, 3, 4, 5], 2)];
    expect(batches).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('defaults to ARRAY_APPEND_BATCH', () => {
    const items = Array.from({ length: ARRAY_APPEND_BATCH + 1 }, (_, i) => i);
    const batches = [...batchesOf(items)];
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(ARRAY_APPEND_BATCH);
    expect(batches[1]).toHaveLength(1);
  });
});
