import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import type { Currency } from '@infiny-stream/types';
import { Subscription } from './subscription.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription) private readonly subscriptionsRepo: Repository<Subscription>,
    private readonly configService: ConfigService
  ) {}

  /** Every new account gets the full-featured trial immediately (product rule #35). */
  async startTrial(userId: string): Promise<Subscription> {
    const trialDays = this.configService.get<number>('pricing.trialDays')!;
    const now = new Date();
    const endDate = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const subscription = this.subscriptionsRepo.create({
      userId,
      plan: 'trial',
      status: 'active',
      price: 0,
      currency: this.configService.get<Currency>('pricing.baseCurrency')!,
      startDate: now,
      endDate,
    });
    return this.subscriptionsRepo.save(subscription);
  }

  async getActiveForUser(userId: string): Promise<Subscription | null> {
    const subscription = await this.subscriptionsRepo.findOne({
      where: { userId },
      order: { endDate: 'DESC' },
    });
    if (!subscription) return null;

    // Status is stored, but expiry is always re-derived from endDate here
    // rather than trusted blindly — a background job should also flip
    // `status` to 'expired' periodically, but the source of truth for
    // "is access currently granted" is always "now < endDate AND status
    // === active" (product rule #41: never trust a stale local flag).
    const isCurrentlyActive = subscription.status === 'active' && subscription.endDate.getTime() > Date.now();
    return isCurrentlyActive ? subscription : { ...subscription, status: 'expired' };
  }

  /** Activates Premium for one year from now, tied to a confirmed payment transaction. */
  async activatePremium(userId: string, transactionId: string, amount: number, currency: Currency): Promise<Subscription> {
    const now = new Date();
    const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const subscription = this.subscriptionsRepo.create({
      userId,
      plan: 'premium',
      status: 'active',
      price: amount,
      currency,
      startDate: now,
      endDate,
      transactionId,
    });
    return this.subscriptionsRepo.save(subscription);
  }
}
