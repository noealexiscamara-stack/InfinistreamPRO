import type { Subscription, SubscriptionPlan, SubscriptionStatus } from '@infiny-stream/types';
import { fetchMySubscription } from '@/services/subscription/subscriptionApi';

export interface SubscriptionViewStatus {
  subscription: Subscription;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  /** Server-derived entitlement — never trust a local-only flag (rule #41). */
  isEntitled: boolean;
  isPremium: boolean;
  isTrial: boolean;
  expired: boolean;
  daysRemaining: number;
  startDate: string;
  endDate: string;
}

export function buildSubscriptionViewStatus(subscription: Subscription): SubscriptionViewStatus {
  const endMs = new Date(subscription.endDate).getTime();
  const daysRemaining = Math.max(0, Math.ceil((endMs - Date.now()) / (24 * 60 * 60 * 1000)));
  const expired = subscription.status !== 'active' || endMs <= Date.now();
  const isEntitled = !expired;
  const isPremium = subscription.plan === 'premium' && isEntitled;
  const isTrial = subscription.plan === 'trial' && isEntitled;

  return {
    subscription,
    plan: subscription.plan,
    status: expired ? 'expired' : subscription.status,
    isEntitled,
    isPremium,
    isTrial,
    expired,
    daysRemaining,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
  };
}

/** Fetches /subscriptions/me and maps the server record to UI-friendly status. */
export async function fetchSubscriptionStatus(): Promise<SubscriptionViewStatus | null> {
  const subscription = await fetchMySubscription();
  if (!subscription) return null;
  return buildSubscriptionViewStatus(subscription);
}
