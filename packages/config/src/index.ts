import type { PricingConfig } from '@infiny-stream/types';

/**
 * IMPORTANT: this is a local fallback only, used when the app cannot reach
 * the backend (first launch before any network call, or a fully offline
 * demo/dev build). The backend's /config endpoint (see apps/backend
 * ConfigModule) is the single source of truth for price, currency, trial
 * length and device limit — per product rule #38, the price must never be
 * hardcoded as the thing actually charged. This constant only prevents the
 * UI from showing a blank/broken screen before the first successful sync.
 */
export const FALLBACK_PRICING_CONFIG: PricingConfig = {
  basePrice: 5,
  baseCurrency: 'EUR',
  trialDays: 30,
  deviceLimit: 2,
};

export const APP_NAME = 'Infiny Stream';
export const APP_TAGLINE = "Le streaming qui s'adapte à votre connexion.";

/** Ordered low → high, used to render the resolution ladder consistently across screens. */
export const RESOLUTION_LADDER_ORDER = [240, 360, 480, 720, 1080] as const;

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GNF', 'XOF', 'XAF'] as const;

export const M3U_PARSE_CHUNK_SIZE = 500;

export const NETWORK_SAMPLE_INTERVAL_MS = 4000;
export const QUALITY_REEVALUATION_INTERVAL_MS = 4000;
