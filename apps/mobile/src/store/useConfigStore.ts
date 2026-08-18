import { create } from 'zustand';
import type { PricingConfig } from '@infiny-stream/types';
import { FALLBACK_PRICING_CONFIG } from '@infiny-stream/config';
import { fetchPublicConfig } from '@/services/config/configApi';

interface ConfigState {
  pricing: PricingConfig;
  isLoading: boolean;
  refresh: (country?: string) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  pricing: FALLBACK_PRICING_CONFIG,
  isLoading: false,

  refresh: async (country) => {
    set({ isLoading: true });
    try {
      const pricing = await fetchPublicConfig(country);
      set({ pricing, isLoading: false });
    } catch {
      set({ pricing: FALLBACK_PRICING_CONFIG, isLoading: false });
    }
  },
}));

/** Resolved display price — prefers localized hint from /config when present. */
export function selectDisplayPrice(pricing: PricingConfig): { amount: number; currency: string } {
  if (pricing.localizedPrice) {
    return pricing.localizedPrice;
  }
  return { amount: pricing.basePrice, currency: pricing.baseCurrency };
}
