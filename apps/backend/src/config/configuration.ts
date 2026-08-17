/**
 * Central, environment-driven configuration. Nothing here is hardcoded
 * into the mobile client — see product rule #38: price, currency, trial
 * length and device limit must all be adjustable from the backend/admin
 * without an app release.
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'infiny_stream',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'infiny_stream',
    synchronize: (process.env.DB_SYNCHRONIZE ?? 'false') === 'true',
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },

  security: {
    encryptionKey: process.env.ENCRYPTION_KEY ?? 'dev-encryption-key-change-me',
  },

  pricing: {
    basePrice: parseFloat(process.env.PREMIUM_BASE_PRICE ?? '5'),
    baseCurrency: process.env.PREMIUM_BASE_CURRENCY ?? 'EUR',
    trialDays: parseInt(process.env.TRIAL_DAYS ?? '30', 10),
    deviceLimit: parseInt(process.env.DEVICE_LIMIT ?? '2', 10),
  },

  payments: {
    orangeMoney: { apiKey: process.env.ORANGE_MONEY_API_KEY ?? '', apiSecret: process.env.ORANGE_MONEY_API_SECRET ?? '' },
    mtnMomo: { apiKey: process.env.MTN_MOMO_API_KEY ?? '', apiSecret: process.env.MTN_MOMO_API_SECRET ?? '' },
    holopay: { apiKey: process.env.HOLOPAY_API_KEY ?? '' },
  },
});
