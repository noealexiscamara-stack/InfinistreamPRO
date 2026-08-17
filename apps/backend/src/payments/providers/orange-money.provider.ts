import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentProviderAdapter, InitiatePaymentResult, WebhookVerificationResult } from '../payment-provider.interface';

/**
 * Orange Money adapter — STUB. Orange Money's Web Payment API requires
 * merchant onboarding (merchant key, per-country endpoint, and a signed
 * request flow) that isn't available in this environment. The shape here
 * (initiate -> redirectUrl, verifyWebhook -> signature check) matches
 * Orange Money's actual integration pattern so wiring in real credentials
 * later is a matter of filling in the HTTP calls, not restructuring the
 * app. See docs/LIMITATIONS.md.
 */
@Injectable()
export class OrangeMoneyProvider implements PaymentProviderAdapter {
  readonly id = 'orange_money' as const;

  constructor(private readonly configService: ConfigService) {}

  async initiate(): Promise<InitiatePaymentResult> {
    const apiKey = this.configService.get<string>('payments.orangeMoney.apiKey');
    if (!apiKey) {
      throw new ServiceUnavailableException('Orange Money n’est pas configuré sur ce serveur.');
    }
    throw new ServiceUnavailableException('Intégration Orange Money non implémentée (identifiants marchand requis).');
  }

  async verifyWebhook(): Promise<WebhookVerificationResult> {
    throw new ServiceUnavailableException('Webhook Orange Money non implémenté.');
  }
}
