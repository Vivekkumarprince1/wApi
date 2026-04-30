import { config } from '../config';

export const bspConfig = {
  provider: 'gupshup',

  gupshup: {
    partnerToken: config.gupshupPartnerToken,
    appId: config.gupshupAppId,
    apiKey: config.gupshupApiKey,
    sourceNumber: config.gupshupSourceNumber,
    partnerBaseUrl: config.gupshupPartnerBaseUrl,
    apiBaseUrl: config.gupshupApiBaseUrl,
    webhookAllowedIPs: (process.env.GUPSHUP_WEBHOOK_IPS || '').split(',').map((v) => v.trim()).filter(Boolean)
  },

  rateLimits: {
    messagesPerSecond: 1000,
    dailyMessageLimit: 1000000
  }
} as const;
