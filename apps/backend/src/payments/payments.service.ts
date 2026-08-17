import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import type { Currency, PaymentProvider } from '@infiny-stream/types';
import { Payment } from './payment.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import type { PaymentProviderAdapter } from './payment-provider.interface';
import { OrangeMoneyProvider } from './providers/orange-money.provider';
import { MtnMomoProvider } from './providers/mtn-momo.provider';
import { HoloPayProvider } from './providers/holopay.provider';

@Injectable()
export class PaymentsService {
  private readonly providers: Map<PaymentProvider, PaymentProviderAdapter>;

  constructor(
    @InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>,
    private readonly configService: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    orangeMoney: OrangeMoneyProvider,
    mtnMomo: MtnMomoProvider,
    holopay: HoloPayProvider
  ) {
    this.providers = new Map<PaymentProvider, PaymentProviderAdapter>([
      ['orange_money', orangeMoney],
      ['mtn_momo', mtnMomo],
      ['holopay', holopay],
    ]);
  }

  async initiate(userId: string, provider: PaymentProvider) {
    const adapter = this.providers.get(provider);
    if (!adapter) {
      throw new BadRequestException(`Ce moyen de paiement n'est pas encore disponible : ${provider}.`);
    }

    const amount = this.configService.get<number>('pricing.basePrice')!;
    const currency = this.configService.get<Currency>('pricing.baseCurrency')!;
    const internalTransactionId = randomUUID();

    const payment = this.paymentsRepo.create({
      userId,
      provider,
      amount,
      currency,
      status: 'pending',
      transactionId: internalTransactionId,
    });
    await this.paymentsRepo.save(payment);

    const result = await adapter.initiate({ amount, currency, userId, internalTransactionId });
    return { transactionId: internalTransactionId, redirectUrl: result.redirectUrl };
  }

  /**
   * Called from the provider webhook endpoint. Activation only ever
   * happens here, server-side, after the provider confirms success —
   * never from a client-reported "I paid" call (product rule #41).
   */
  async handleWebhook(providerId: PaymentProvider, rawBody: unknown, headers: Record<string, string>) {
    const adapter = this.providers.get(providerId);
    if (!adapter) throw new BadRequestException('Fournisseur de paiement inconnu.');

    const verification = await adapter.verifyWebhook(rawBody, headers);
    if (!verification.isValid) {
      throw new BadRequestException('Signature de webhook invalide.');
    }

    const payment = await this.paymentsRepo.findOne({ where: { transactionId: verification.providerReference } });
    if (!payment) throw new BadRequestException('Transaction inconnue.');

    payment.status = verification.status === 'success' ? 'success' : verification.status === 'failed' ? 'failed' : 'pending';
    await this.paymentsRepo.save(payment);

    if (payment.status === 'success') {
      await this.subscriptionsService.activatePremium(payment.userId, payment.transactionId, Number(payment.amount), payment.currency);
    }

    return { received: true };
  }
}
