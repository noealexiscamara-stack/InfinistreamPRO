import type { PricingConfig } from '@infiny-stream/types';
import { apiRequest } from '@/services/api/client';

/** Public pricing/trial config — no auth required (product rule #38). */
export async function fetchPublicConfig(country?: string): Promise<PricingConfig> {
  const query = country ? `?country=${encodeURIComponent(country)}` : '';
  return apiRequest<PricingConfig>(`/config${query}`, { method: 'GET', anonymous: true });
}
