import type { Currency } from '@infiny-stream/types';

export interface InitiatePaymentResult {
  /** Where to redirect/open the user to complete payment (USSD prompt, web checkout, deep link…). */
  redirectUrl?: string;
  /** The provider's own reference for this attempt, used to reconcile the webhook callback. */
  providerReference: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  providerReference: string;
  status: 'success' | 'failed' | 'pending';
}

/**
 * Common contract every payment provider adapter implements (product rule
 * #40: "le paiement ne doit pas être directement mélangé à l'interface
 * IPTV" — this interface is what keeps PaymentsService provider-agnostic).
 * Concrete adapters (Orange Money, MTN MoMo, HoloPay) live in ./providers
 * and are intentionally stubbed pending real merchant credentials/API
 * docs from each provider — see docs/LIMITATIONS.md.
 */
export interface PaymentProviderAdapter {
  readonly id: 'orange_money' | 'mtn_momo' | 'holopay';
  initiate(params: { amount: number; currency: Currency; userId: string; internalTransactionId: string }): Promise<InitiatePaymentResult>;
  verifyWebhook(rawBody: unknown, headers: Record<string, string>): Promise<WebhookVerificationResult>;
}
