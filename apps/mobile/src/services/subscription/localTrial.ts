import { FALLBACK_PRICING_CONFIG } from '@infiny-stream/config';
import { storage } from '@/utils/mmkv';

const TRIAL_STARTED_AT_KEY = 'subscription.trialStartedAt';

/**
 * IMPORTANT — this is a client-side convenience only, never proof of an
 * active subscription (product rule #41: "ne jamais considérer
 * uniquement une information locale comme preuve définitive d'un
 * abonnement actif"). It exists purely so the Compte/Abonnement screens
 * have something honest to show before apps/backend's SubscriptionService
 * is wired into the mobile client. Once that integration lands, this
 * value must be reconciled with (and ultimately superseded by) the
 * server's record on every app start.
 */
export function ensureTrialStarted(): void {
  if (!storage.contains(TRIAL_STARTED_AT_KEY)) {
    storage.set(TRIAL_STARTED_AT_KEY, new Date().toISOString());
  }
}

export function getTrialStatus(): { startedAt: string; daysRemaining: number; expired: boolean } {
  ensureTrialStarted();
  const startedAt = storage.getString(TRIAL_STARTED_AT_KEY) as string;
  const elapsedDays = Math.floor((Date.now() - new Date(startedAt).getTime()) / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.max(0, FALLBACK_PRICING_CONFIG.trialDays - elapsedDays);
  return { startedAt, daysRemaining, expired: daysRemaining <= 0 };
}
