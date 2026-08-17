import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentProviderAdapter, InitiatePaymentResult, WebhookVerificationResult } from '../payment-provider.interface';

/**
 * MTN Mobile Money adapter — STUB, same status as Orange Money (see that
 * file's doc comment): MTN MoMo's Collections API needs a registered
 * subscription key + API user/key pair per country that this environment
 * doesn't have. Structure matches MTN's actual request-to-pay flow.
 */
@Injectable()
export class MtnMomoProvider implements PaymentProviderAdapter {
  readonly id = 'mtn_momo' as const;

  constructor(private readonly configService: ConfigService) {}

  async initiate(): Promise<InitiatePaymentResult> {
    const apiKey = this.configService.get<string>('payments.mtnMomo.apiKey');
    if (!apiKey) {
      throw new ServiceUnavailableException('MTN Mobile Money n’est pas configuré sur ce serveur.');
    }
    throw new ServiceUnavailableException('Intégration MTN MoMo non implémentée (identifiants marchand requis).');
  }

  async verifyWebhook(): Promise<WebhookVerificationResult> {
    throw new ServiceUnavailableException('Webhook MTN MoMo non implémenté.');
  }
}
