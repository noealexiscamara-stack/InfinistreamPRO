import type { User } from '@infiny-stream/types';
import { apiGet } from '@/services/api/client';

export async function fetchCurrentUser(): Promise<User> {
  const raw = await apiGet<Record<string, unknown>>('/users/me');
  return {
    id: String(raw.id),
    name: raw.name != null ? String(raw.name) : undefined,
    email: raw.email != null ? String(raw.email) : undefined,
    phone: raw.phone != null ? String(raw.phone) : undefined,
    country: raw.country != null ? String(raw.country) : undefined,
    createdAt: toIsoString(raw.createdAt ?? raw.created_at),
  };
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}
