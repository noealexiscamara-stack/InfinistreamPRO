import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentProviderAdapter, InitiatePaymentResult, WebhookVerificationResult } from '../payment-provider.interface';

/**
 * HoloPay adapter — STUB, same status as the other two providers. No
 * public API reference was available while building this scaffold; wire
 * in real endpoints once HoloPay merchant docs/credentials are available.
 */
@Injectable()
export class HoloPayProvider implements PaymentProviderAdapter {
  readonly id = 'holopay' as const;

  constructor(private readonly configService: ConfigService) {}

  async initiate(): Promise<InitiatePaymentResult> {
    const apiKey = this.configService.get<string>('payments.holopay.apiKey');
    if (!apiKey) {
      throw new ServiceUnavailableException('HoloPay n’est pas configuré sur ce serveur.');
    }
    throw new ServiceUnavailableException('Intégration HoloPay non implémentée (identifiants marchand requis).');
  }

  async verifyWebhook(): Promise<WebhookVerificationResult> {
    throw new ServiceUnavailableException('Webhook HoloPay non implémenté.');
  }
}
