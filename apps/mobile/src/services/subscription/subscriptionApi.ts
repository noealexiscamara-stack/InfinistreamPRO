import type { Subscription } from '@infiny-stream/types';
import { apiGet, ApiError } from '@/services/api/client';

export async function fetchMySubscription(): Promise<Subscription | null> {
  try {
    const raw = await apiGet<Record<string, unknown>>('/subscriptions/me');
    return normalizeSubscription(raw);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

function normalizeSubscription(raw: Record<string, unknown>): Subscription {
  return {
    id: String(raw.id),
    userId: String(raw.userId ?? raw.user_id ?? ''),
    plan: raw.plan as Subscription['plan'],
    status: raw.status as Subscription['status'],
    price: Number(raw.price),
    currency: raw.currency as Subscription['currency'],
    startDate: toIsoString(raw.startDate ?? raw.start_date),
    endDate: toIsoString(raw.endDate ?? raw.end_date),
    transactionId: raw.transactionId != null ? String(raw.transactionId) : raw.transaction_id != null ? String(raw.transaction_id) : undefined,
  };
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  throw new Error('Invalid subscription date from server.');
}
