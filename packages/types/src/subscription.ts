export type SubscriptionPlan = 'trial' | 'premium';
export type SubscriptionStatus = 'active' | 'expired' | 'canceled' | 'pending';
export type Currency = 'EUR' | 'USD' | 'GNF' | 'XOF' | 'XAF';
export type PaymentProvider = 'orange_money' | 'mtn_momo' | 'holopay' | 'card';
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
export type DevicePlatform = 'android' | 'android_tv' | 'ios' | 'web';
export type DeviceStatus = 'active' | 'revoked';

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  price: number;
  currency: Currency;
  startDate: string;
  endDate: string;
  transactionId?: string;
}

export interface Device {
  id: string;
  userId: string;
  deviceName: string;
  platform: DevicePlatform;
  lastActive: string;
  status: DeviceStatus;
}

export interface Payment {
  id: string;
  userId: string;
  provider: PaymentProvider;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  transactionId: string;
  createdAt: string;
}

export interface PricingConfig {
  basePrice: number;
  baseCurrency: Currency;
  trialDays: number;
  deviceLimit: number;
  /** Optional per-country override, resolved server-side. */
  localizedPrice?: {
    amount: number;
    currency: Currency;
  };
}
