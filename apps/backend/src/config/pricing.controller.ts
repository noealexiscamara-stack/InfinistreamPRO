import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Currency, PricingConfig } from '@infiny-stream/types';

/**
 * Country -> local currency mapping used for the African pricing rule
 * (#39). This only picks a *currency* to display; converting the EUR base
 * price into a fair local amount is a business decision (promotions,
 * purchasing-power adjustments) that belongs in the admin-configurable
 * pricing table, not a hardcoded FX rate here — so `localizedPrice` is
 * left undefined until that table exists, and the client falls back to
 * showing the base price/currency.
 */
const COUNTRY_CURRENCY: Record<string, Currency> = {
  GN: 'GNF',
  SN: 'XOF',
  CI: 'XOF',
  ML: 'XOF',
  BF: 'XOF',
  CM: 'XAF',
  GA: 'XAF',
  TD: 'XAF',
  US: 'USD',
};

@Controller('config')
export class PricingController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Single source of truth for the mobile client's pricing/trial/device
   * display (product rule #38). `country` is an optional ISO 3166-1
   * alpha-2 code the client can pass (e.g. from device locale) to get a
   * currency hint for African markets (rule #39).
   */
  @Get()
  getPublicConfig(@Query('country') country?: string): PricingConfig {
    const pricing = this.configService.get('pricing');
    const currencyHint = country ? COUNTRY_CURRENCY[country.toUpperCase()] : undefined;

    return {
      basePrice: pricing.basePrice,
      baseCurrency: pricing.baseCurrency,
      trialDays: pricing.trialDays,
      deviceLimit: pricing.deviceLimit,
      ...(currencyHint && currencyHint !== pricing.baseCurrency
        ? { localizedPrice: { amount: pricing.basePrice, currency: currencyHint } }
        : {}),
    };
  }
}
