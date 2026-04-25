/**
 * BSP (Business Solution Provider) Configuration
 * 
 * Centralizes all Gupshup Partner + WhatsApp credentials for multi-tenant messaging.
 */

export const bspConfig = {
  provider: 'gupshup',

  gupshup: {
    partnerToken: process.env.GUPSHUP_PARTNER_TOKEN,
    appId: process.env.GUPSHUP_APP_ID,
    apiKey: process.env.GUPSHUP_API_KEY,
    sourceNumber: process.env.GUPSHUP_SOURCE_NUMBER,
    partnerBaseUrl: process.env.GUPSHUP_PARTNER_BASE_URL || 'https://partner.gupshup.io',
    apiBaseUrl: process.env.GUPSHUP_API_BASE_URL || 'https://api.gupshup.io',
    webhookAllowedIPs: (process.env.GUPSHUP_WEBHOOK_IPS || '').split(',').map((v) => v.trim()).filter(Boolean)
  },

  rateLimits: {
    messagesPerSecond: 1000,
    dailyMessageLimit: 1000000
  }
} as const;
