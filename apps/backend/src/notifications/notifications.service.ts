import { Injectable, Logger } from '@nestjs/common';

export type NotificationKind = 'trial_ending_soon' | 'subscription_expiring_soon' | 'subscription_expired' | 'payment_confirmed';

/**
 * STUB: logs what would be sent. Real push delivery (product rule #43 —
 * "Votre abonnement expire bientôt") needs a push provider (FCM/APNs) and
 * device push tokens, which aren't wired up in this pass — see
 * docs/LIMITATIONS.md. Kept as its own module/service so that wiring is
 * additive (implement `deliver()`, nothing else changes) rather than a
 * refactor.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async notify(userId: string, kind: NotificationKind, context: Record<string, unknown> = {}): Promise<void> {
    this.logger.log(`[notification stub] user=${userId} kind=${kind} context=${JSON.stringify(context)}`);
  }
}
