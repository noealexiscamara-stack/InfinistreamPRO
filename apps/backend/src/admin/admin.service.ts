import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { Payment } from '../payments/payment.entity';
import { Device } from '../devices/device.entity';
import { Playlist } from '../playlists/playlist.entity';
import {
  accumulate,
  metric,
  resolvePeriod,
  zeroFill,
  type BucketUnit,
  type Metric,
  type PeriodKey,
} from './admin-period';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Postgres date_trunc units, mapped from our bucket vocabulary. */
const TRUNC: Record<BucketUnit, string> = { day: 'day', week: 'week', month: 'month' };

export interface DashboardKpis {
  users: Metric & { totalAllTime: number };
  trials: { active: number; expired: number; started: Metric };
  premium: { active: number; expiringSoon: number; started: Metric };
  revenue: Metric & { currency: string };
  conversion: { rate: number | null };
  period: { key: PeriodKey; since: string; until: string };
}

export type ActivityKind =
  | 'user_registered'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'premium_started'
  | 'playlist_added';

export interface ActivityItem {
  kind: ActivityKind;
  at: string;
  userLabel: string | null;
  detail: string | null;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Subscription) private readonly subscriptionsRepo: Repository<Subscription>,
    @InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>,
    @InjectRepository(Device) private readonly devicesRepo: Repository<Device>,
    @InjectRepository(Playlist) private readonly playlistsRepo: Repository<Playlist>
  ) {}

  /**
   * Headline KPIs (product rule #49), each paired with the same figure over
   * the immediately preceding window so the UI can show a real evolution
   * rather than a decorative one. See `metric()` for why `changePct` is
   * nullable — on a young product the previous window is usually zero, and
   * there is no honest percentage to report against a zero baseline.
   */
  async getDashboard(periodKey: PeriodKey = '30d', now: Date = new Date()): Promise<DashboardKpis> {
    const p = resolvePeriod(periodKey, now);
    const soonCutoff = new Date(now.getTime() + 7 * DAY_MS);

    const [
      totalUsers,
      newUsers,
      newUsersPrev,
      trialsStarted,
      trialsStartedPrev,
      trialsActive,
      trialsExpired,
      premiumActive,
      premiumStarted,
      premiumStartedPrev,
      premiumExpiringSoon,
      revenue,
      revenuePrev,
    ] = await Promise.all([
      this.usersRepo.count(),
      this.usersRepo.count({ where: { createdAt: Between(p.since, p.until) } }),
      this.usersRepo.count({ where: { createdAt: Between(p.previousSince, p.since) } }),

      this.subscriptionsRepo.count({ where: { plan: 'trial', startDate: Between(p.since, p.until) } }),
      this.subscriptionsRepo.count({ where: { plan: 'trial', startDate: Between(p.previousSince, p.since) } }),
      this.subscriptionsRepo.count({ where: { plan: 'trial', status: 'active', endDate: MoreThanOrEqual(now) } }),
      this.subscriptionsRepo.count({ where: { plan: 'trial', endDate: LessThanOrEqual(now) } }),

      this.subscriptionsRepo.count({ where: { plan: 'premium', status: 'active', endDate: MoreThanOrEqual(now) } }),
      this.subscriptionsRepo.count({ where: { plan: 'premium', startDate: Between(p.since, p.until) } }),
      this.subscriptionsRepo.count({ where: { plan: 'premium', startDate: Between(p.previousSince, p.since) } }),
      this.subscriptionsRepo.count({
        where: { plan: 'premium', status: 'active', endDate: Between(now, soonCutoff) },
      }),

      this.sumRevenue(p.since, p.until),
      this.sumRevenue(p.previousSince, p.since),
    ]);

    const conversionRate = await this.trialConversionRate(now);

    return {
      users: { ...metric(newUsers, newUsersPrev), totalAllTime: totalUsers },
      trials: { active: trialsActive, expired: trialsExpired, started: metric(trialsStarted, trialsStartedPrev) },
      premium: {
        active: premiumActive,
        expiringSoon: premiumExpiringSoon,
        started: metric(premiumStarted, premiumStartedPrev),
      },
      revenue: { ...metric(revenue, revenuePrev), currency: 'EUR' },
      conversion: { rate: conversionRate },
      period: { key: p.key, since: p.since.toISOString(), until: p.until.toISOString() },
    };
  }

  /**
   * Series for the two dashboard charts. Every bucket in the range is
   * present, including empty ones, so a chart cannot imply a trend by
   * joining two points across a gap.
   */
  async getSeries(periodKey: PeriodKey = '30d', now: Date = new Date()) {
    const p = resolvePeriod(periodKey, now);
    const trunc = TRUNC[p.unit];

    const [signupRows, premiumRows, revenueRows, usersBefore, premiumBefore] = await Promise.all([
      this.bucketCount(this.usersRepo, 'created_at', trunc, p.since, p.until),
      this.bucketCount(this.subscriptionsRepo, 'start_date', trunc, p.since, p.until, {
        clause: 't.plan = :plan',
        params: { plan: 'premium' },
      }),
      this.bucketRevenue(trunc, p.since, p.until),
      this.usersRepo.count({ where: { createdAt: LessThanOrEqual(p.since) } }),
      this.subscriptionsRepo.count({ where: { plan: 'premium', startDate: LessThanOrEqual(p.since) } }),
    ]);

    const newUsers = zeroFill(signupRows, p.since, p.until, p.unit);
    const newPremium = zeroFill(premiumRows, p.since, p.until, p.unit);

    return {
      period: { key: p.key, unit: p.unit, since: p.since.toISOString(), until: p.until.toISOString() },
      users: {
        // Cumulative — plotting daily signups as if they were the running
        // total is a classic way to make a chart say the wrong thing.
        total: accumulate(newUsers, usersBefore),
        new: newUsers,
        premium: accumulate(newPremium, premiumBefore),
      },
      revenue: { currency: 'EUR', points: zeroFill(revenueRows, p.since, p.until, p.unit) },
    };
  }

  /**
   * Cross-entity activity feed, built by UNION over the tables that
   * actually carry a timestamp rather than from a separate event log —
   * so every row shown corresponds to something that really happened,
   * with no second stream that can drift out of sync.
   *
   * Device connections are deliberately absent: `devices` records only
   * `last_active`, never a creation time, so "new device connected" would
   * be a guess. The devices panel covers that instead.
   */
  async getRecentActivity(limit = 20): Promise<ActivityItem[]> {
    const capped = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);

    const rows: Array<{ kind: ActivityKind; at: Date; user_label: string | null; detail: string | null }> =
      await this.usersRepo.query(
        `
      SELECT kind, at, user_label, detail FROM (
        SELECT 'user_registered' AS kind, u.created_at AS at,
               COALESCE(u.email, u.phone, u.name) AS user_label, NULL::text AS detail
          FROM users u
        UNION ALL
        SELECT CASE WHEN p.status = 'success' THEN 'payment_succeeded' ELSE 'payment_failed' END,
               p.created_at, COALESCE(u.email, u.phone, u.name),
               p.amount::text || ' ' || p.currency || ' - ' || p.provider
          FROM payments p JOIN users u ON u.id = p.user_id
         WHERE p.status IN ('success', 'failed')
        UNION ALL
        SELECT 'premium_started', s.start_date, COALESCE(u.email, u.phone, u.name), s.plan
          FROM subscriptions s JOIN users u ON u.id = s.user_id
         WHERE s.plan = 'premium'
        UNION ALL
        SELECT 'playlist_added', pl.created_at, COALESCE(u.email, u.phone, u.name), pl.type
          FROM playlists pl JOIN users u ON u.id = pl.user_id
      ) feed
      ORDER BY at DESC
      LIMIT $1
      `,
        [capped]
      );

    return rows.map((r) => ({
      kind: r.kind,
      at: new Date(r.at).toISOString(),
      userLabel: r.user_label,
      detail: r.detail,
    }));
  }

  /** Most recent payments across all users. Never exposes provider credentials. */
  async getRecentPayments(limit = 20) {
    const capped = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
    const rows = await this.paymentsRepo
      .createQueryBuilder('p')
      .leftJoin('p.user', 'u')
      .select('p.id', 'id')
      .addSelect('p.amount', 'amount')
      .addSelect('p.currency', 'currency')
      .addSelect('p.provider', 'provider')
      .addSelect('p.status', 'status')
      .addSelect('p.created_at', 'at')
      .addSelect('COALESCE(u.email, u.phone, u.name)', 'user_label')
      .orderBy('p.created_at', 'DESC')
      .limit(capped)
      .getRawMany();

    return rows.map((r) => ({
      id: r.id,
      userLabel: r.user_label ?? null,
      amount: Number(r.amount),
      currency: r.currency,
      provider: r.provider,
      status: r.status,
      at: new Date(r.at).toISOString(),
    }));
  }

  /**
   * Devices ordered by recency of use.
   *
   * No IP address: the entity stores none, and adding one would mean
   * holding personal data under GDPR for a panel that reads perfectly well
   * without it. If it is ever added it needs a stated retention period.
   */
  async getActiveDevices(limit = 20) {
    const capped = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
    const rows = await this.devicesRepo
      .createQueryBuilder('d')
      .leftJoin('d.user', 'u')
      .select('d.id', 'id')
      .addSelect('d.device_name', 'device_name')
      .addSelect('d.platform', 'platform')
      .addSelect('d.last_active', 'last_active')
      .addSelect('d.status', 'status')
      .addSelect('COALESCE(u.email, u.phone, u.name)', 'user_label')
      .where('d.status = :status', { status: 'active' })
      .orderBy('d.last_active', 'DESC')
      .limit(capped)
      .getRawMany();

    return rows.map((r) => ({
      id: r.id,
      deviceName: r.device_name,
      platform: r.platform,
      userLabel: r.user_label ?? null,
      lastActive: new Date(r.last_active).toISOString(),
      status: r.status,
    }));
  }

  // --- helpers ------------------------------------------------------------

  /**
   * Share of finished trials that turned into a paying subscription
   * (product rule #50).
   *
   * Measured over *users*, not over subscription rows, and the numerator is
   * a strict subset of the denominator — so the result is bounded by 100%
   * by construction. The earlier implementation divided currently-active
   * premium subscriptions by expired trials, two populations that do not
   * overlap: a user can go premium without their trial ever expiring, and
   * that produced a literally impossible 200% on the first dataset with
   * real shape. On an investor-facing dashboard that is worse than showing
   * nothing.
   *
   * Returns null rather than 0 when no trial has finished yet: there is
   * nothing to convert from, and 0% would read as a failure instead of an
   * absence of data.
   */
  private async trialConversionRate(now: Date): Promise<number | null> {
    const row = await this.subscriptionsRepo.query(
      `
      WITH finished_trials AS (
        SELECT DISTINCT user_id FROM subscriptions
         WHERE plan = 'trial' AND end_date <= $1
      )
      SELECT
        (SELECT COUNT(*) FROM finished_trials) AS denominator,
        (SELECT COUNT(*) FROM finished_trials f
          WHERE EXISTS (SELECT 1 FROM subscriptions s
                         WHERE s.user_id = f.user_id AND s.plan = 'premium')) AS numerator
      `,
      [now]
    );

    const denominator = Number(row?.[0]?.denominator ?? 0);
    const numerator = Number(row?.[0]?.numerator ?? 0);
    if (denominator === 0) return null;
    return Math.round((numerator / denominator) * 1000) / 10;
  }

  private async sumRevenue(since: Date, until: Date): Promise<number> {
    const row = await this.paymentsRepo
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.status = :status', { status: 'success' })
      .andWhere('payment.created_at >= :since', { since })
      .andWhere('payment.created_at < :until', { until })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async bucketCount(
    repo: Repository<User> | Repository<Subscription>,
    column: string,
    trunc: string,
    since: Date,
    until: Date,
    extra?: { clause: string; params: Record<string, unknown> }
  ): Promise<Array<{ bucket: Date; value: string }>> {
    // `trunc` is never user input — it comes from the TRUNC map, keyed by
    // our own BucketUnit union — so interpolating it is safe. Dates stay
    // parameterised.
    const qb = (repo as Repository<User>)
      .createQueryBuilder('t')
      .select(`date_trunc('${trunc}', t.${column})`, 'bucket')
      .addSelect('COUNT(*)', 'value')
      .where(`t.${column} >= :since`, { since })
      .andWhere(`t.${column} < :until`, { until })
      .groupBy('bucket');
    if (extra) qb.andWhere(extra.clause, extra.params);
    return qb.getRawMany();
  }

  private async bucketRevenue(trunc: string, since: Date, until: Date): Promise<Array<{ bucket: Date; value: string }>> {
    return this.paymentsRepo
      .createQueryBuilder('p')
      .select(`date_trunc('${trunc}', p.created_at)`, 'bucket')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'value')
      .where('p.status = :status', { status: 'success' })
      .andWhere('p.created_at >= :since', { since })
      .andWhere('p.created_at < :until', { until })
      .groupBy('bucket')
      .getRawMany();
  }
}
