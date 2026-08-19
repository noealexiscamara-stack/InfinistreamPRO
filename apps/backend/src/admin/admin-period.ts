/**
 * Period handling for the admin dashboard.
 *
 * Two rules drive everything here, and both come from the same place: a
 * dashboard that quietly makes numbers up is worse than one that admits it
 * has none.
 *
 *  - A percentage change is only reported when there is something to
 *    compare against. Growing from 0 to 5 is not "+500%" and it is not
 *    "+100%" — it has no meaningful percentage, so `changePct` is null and
 *    the UI must render something like "—" rather than a fabricated
 *    figure.
 *  - Series are zero-filled across every bucket in the range, so a chart
 *    never invents a trend by connecting two distant points across days
 *    that simply had no data.
 */

export type PeriodKey = '7d' | '30d' | '90d' | '1y';

export type BucketUnit = 'day' | 'week' | 'month';

export interface PeriodRange {
  key: PeriodKey;
  /** Start of the current window (inclusive). */
  since: Date;
  /** End of the current window (exclusive) — "now". */
  until: Date;
  /** Start of the immediately preceding window of identical length. */
  previousSince: Date;
  /** Bucket width used for the time series over this range. */
  unit: BucketUnit;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const PERIOD_DAYS: Record<PeriodKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

/**
 * Bucket width per range, chosen so a chart stays readable: daily points
 * for a week or a month, weekly for a quarter, monthly for a year.
 */
const PERIOD_UNIT: Record<PeriodKey, BucketUnit> = {
  '7d': 'day',
  '30d': 'day',
  '90d': 'week',
  '1y': 'month',
};

export const PERIOD_KEYS: PeriodKey[] = ['7d', '30d', '90d', '1y'];

export function isPeriodKey(value: unknown): value is PeriodKey {
  return typeof value === 'string' && (PERIOD_KEYS as string[]).includes(value);
}

export function resolvePeriod(key: PeriodKey, now: Date = new Date()): PeriodRange {
  const days = PERIOD_DAYS[key];
  const since = new Date(now.getTime() - days * DAY_MS);
  return {
    key,
    since,
    until: now,
    previousSince: new Date(now.getTime() - 2 * days * DAY_MS),
    unit: PERIOD_UNIT[key],
  };
}

export interface Metric {
  value: number;
  /** Same metric over the immediately preceding window of equal length. */
  previous: number;
  /**
   * Percentage change, rounded to one decimal. **Null when `previous` is
   * 0** — there is no honest percentage to report against a zero baseline,
   * and this is exactly the case a young product sits in, so the UI must
   * handle null rather than treat it as an edge case that never happens.
   */
  changePct: number | null;
}

export function metric(value: number, previous: number): Metric {
  return {
    value,
    previous,
    changePct: previous === 0 ? null : Math.round(((value - previous) / previous) * 1000) / 10,
  };
}

export interface SeriesPoint {
  /** Bucket start, ISO date. */
  t: string;
  v: number;
}

/**
 * Enumerates every bucket start in [since, until), so callers can
 * zero-fill. Uses UTC boundaries throughout: the server is the single
 * source of truth for what "a day" means, and mixing in a client timezone
 * would make two viewers see different totals for the same data.
 */
export function bucketStarts(since: Date, until: Date, unit: BucketUnit): Date[] {
  const out: Date[] = [];
  const cursor = truncate(since, unit);
  while (cursor < until) {
    out.push(new Date(cursor));
    advance(cursor, unit);
  }
  return out;
}

export function truncate(date: Date, unit: BucketUnit): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  if (unit === 'week') {
    // ISO weeks start on Monday. getUTCDay() is 0 for Sunday.
    const dow = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dow);
  } else if (unit === 'month') {
    d.setUTCDate(1);
  }
  return d;
}

function advance(cursor: Date, unit: BucketUnit): void {
  if (unit === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
  else if (unit === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
  else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
}

/**
 * Turns sparse `{bucket, count}` rows from SQL into a dense series with a
 * point for every bucket in the range.
 */
export function zeroFill(
  rows: Array<{ bucket: Date | string; value: number | string }>,
  since: Date,
  until: Date,
  unit: BucketUnit
): SeriesPoint[] {
  const byKey = new Map<number, number>();
  for (const row of rows) {
    const bucket = truncate(new Date(row.bucket), unit);
    byKey.set(bucket.getTime(), Number(row.value) || 0);
  }
  return bucketStarts(since, until, unit).map((start) => ({
    t: start.toISOString(),
    v: byKey.get(start.getTime()) ?? 0,
  }));
}

/**
 * Turns per-bucket increments into a running total, given the count that
 * already existed before the window opened. Used for "total users", which
 * is a cumulative curve rather than a per-day count — plotting the daily
 * signups as if they were the total is a classic way to make a chart lie.
 */
export function accumulate(points: SeriesPoint[], startingFrom: number): SeriesPoint[] {
  let running = startingFrom;
  return points.map((p) => {
    running += p.v;
    return { t: p.t, v: running };
  });
}
