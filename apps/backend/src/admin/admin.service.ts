import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { Payment } from '../payments/payment.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Subscription) private readonly subscriptionsRepo: Repository<Subscription>,
    @InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>
  ) {}

  /** Implements the KPI set from product rule #49. */
  async getDashboard() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * DAY_MS);

    const [totalUsers, newUsers] = await Promise.all([
      this.usersRepo.count(),
      this.usersRepo.count({ where: { createdAt: MoreThanOrEqual(thirtyDaysAgo) } }),
    ]);

    const [trialsStarted, trialsActive, trialsExpired] = await Promise.all([
      this.subscriptionsRepo.count({ where: { plan: 'trial' } }),
      this.subscriptionsRepo.count({ where: { plan: 'trial', status: 'active', endDate: MoreThanOrEqual(now) } }),
      this.subscriptionsRepo.count({ where: { plan: 'trial', endDate: LessThanOrEqual(now) } }),
    ]);

    const [premiumActive, premiumNew, premiumExpiringSoon] = await Promise.all([
      this.subscriptionsRepo.count({ where: { plan: 'premium', status: 'active', endDate: MoreThanOrEqual(now) } }),
      this.subscriptionsRepo.count({ where: { plan: 'premium', startDate: MoreThanOrEqual(thirtyDaysAgo) } }),
      this.subscriptionsRepo.count({
        where: { plan: 'premium', status: 'active', endDate: Between(now, sevenDaysFromNow) },
      }),
    ]);

    const revenueLast30Days = await this.paymentsRepo
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.status = :status', { status: 'success' })
      .andWhere('payment.created_at >= :since', { since: thirtyDaysAgo })
      .getRawOne<{ total: string }>();

    // Product rule #50: conversion = premium users / finished trials * 100.
    const conversionRate = trialsExpired > 0 ? Math.round((premiumActive / trialsExpired) * 1000) / 10 : 0;

    return {
      users: { total: totalUsers, new: newUsers },
      trials: { started: trialsStarted, active: trialsActive, expired: trialsExpired },
      premium: { active: premiumActive, new: premiumNew, expiringSoon: premiumExpiringSoon },
      conversion: { rate: conversionRate },
      revenue: { last30Days: Number(revenueLast30Days?.total ?? 0) },
    };
  }
}
