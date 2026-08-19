import {
  accumulate,
  bucketStarts,
  isPeriodKey,
  metric,
  resolvePeriod,
  truncate,
  zeroFill,
} from '../admin-period';

const NOW = new Date('2026-08-19T12:00:00.000Z');

describe('metric', () => {
  it('reports a real percentage when there is a baseline', () => {
    expect(metric(120, 100).changePct).toBe(20);
    expect(metric(80, 100).changePct).toBe(-20);
  });

  // The point of the whole module: a young product sits at zero, and this
  // is where dashboards start lying.
  it('refuses to invent a percentage against a zero baseline', () => {
    expect(metric(5, 0)).toEqual({ value: 5, previous: 0, changePct: null });
    expect(metric(0, 0)).toEqual({ value: 0, previous: 0, changePct: null });
  });

  it('reports a clean -100% when something falls to zero', () => {
    expect(metric(0, 40).changePct).toBe(-100);
  });

  it('rounds to one decimal rather than emitting float noise', () => {
    expect(metric(1, 3).changePct).toBe(-66.7);
  });
});

describe('resolvePeriod', () => {
  it('puts the comparison window immediately before the current one', () => {
    const p = resolvePeriod('30d', NOW);
    expect(p.until).toEqual(NOW);
    expect(p.since.toISOString()).toBe('2026-07-20T12:00:00.000Z');
    expect(p.previousSince.toISOString()).toBe('2026-06-20T12:00:00.000Z');
    // The two windows are the same length and share a boundary.
    expect(p.since.getTime() - p.previousSince.getTime()).toBe(p.until.getTime() - p.since.getTime());
  });

  it('widens the bucket as the range grows, to keep charts readable', () => {
    expect(resolvePeriod('7d', NOW).unit).toBe('day');
    expect(resolvePeriod('30d', NOW).unit).toBe('day');
    expect(resolvePeriod('90d', NOW).unit).toBe('week');
    expect(resolvePeriod('1y', NOW).unit).toBe('month');
  });
});

describe('isPeriodKey', () => {
  it('accepts only the four supported ranges', () => {
    expect(isPeriodKey('7d')).toBe(true);
    expect(isPeriodKey('1y')).toBe(true);
    expect(isPeriodKey('42d')).toBe(false);
    expect(isPeriodKey('')).toBe(false);
    expect(isPeriodKey(undefined)).toBe(false);
    expect(isPeriodKey({})).toBe(false);
  });
});

describe('truncate', () => {
  it('snaps a week to the Monday, not the Sunday', () => {
    // 2026-08-19 is a Wednesday.
    expect(truncate(new Date('2026-08-19T23:59:00Z'), 'week').toISOString()).toBe('2026-08-17T00:00:00.000Z');
    // A Sunday belongs to the week that started the previous Monday.
    expect(truncate(new Date('2026-08-23T10:00:00Z'), 'week').toISOString()).toBe('2026-08-17T00:00:00.000Z');
  });

  it('snaps a month to the first', () => {
    expect(truncate(new Date('2026-08-19T23:59:00Z'), 'month').toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('bucketStarts', () => {
  it('covers a week with seven daily buckets', () => {
    const p = resolvePeriod('7d', NOW);
    expect(bucketStarts(p.since, p.until, 'day')).toHaveLength(8); // partial day at each end
  });

  it('walks months across a year boundary', () => {
    const starts = bucketStarts(new Date('2025-11-15T00:00:00Z'), new Date('2026-02-10T00:00:00Z'), 'month');
    expect(starts.map((d) => d.toISOString().slice(0, 7))).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('zeroFill', () => {
  const since = new Date('2026-08-15T00:00:00Z');
  const until = new Date('2026-08-19T00:00:00Z');

  it('emits a point for every bucket, including the empty ones', () => {
    const out = zeroFill([{ bucket: '2026-08-17T00:00:00Z', value: 3 }], since, until, 'day');
    expect(out).toHaveLength(4);
    expect(out.map((p) => p.v)).toEqual([0, 0, 3, 0]);
  });

  it('never leaves a gap a chart could draw a false trend across', () => {
    const out = zeroFill([], since, until, 'day');
    expect(out.every((p) => p.v === 0)).toBe(true);
    expect(out).toHaveLength(4);
  });

  it('coerces the string counts Postgres returns', () => {
    const out = zeroFill([{ bucket: '2026-08-15T00:00:00Z', value: '7' }], since, until, 'day');
    expect(out[0].v).toBe(7);
  });

  it('tolerates a timestamp mid-bucket by snapping it', () => {
    const out = zeroFill([{ bucket: '2026-08-16T13:45:00Z', value: 2 }], since, until, 'day');
    expect(out[1]).toEqual({ t: '2026-08-16T00:00:00.000Z', v: 2 });
  });
});

describe('accumulate', () => {
  it('turns per-bucket increments into a running total', () => {
    const points = [
      { t: 'a', v: 2 },
      { t: 'b', v: 0 },
      { t: 'c', v: 5 },
    ];
    expect(accumulate(points, 10).map((p) => p.v)).toEqual([12, 12, 17]);
  });

  it('starts from what already existed before the window opened', () => {
    // Otherwise "total users" would restart at zero on every range change,
    // which reads as though the product lost all its users.
    expect(accumulate([{ t: 'a', v: 1 }], 500)[0].v).toBe(501);
  });
});
