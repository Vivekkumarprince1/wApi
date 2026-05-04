/**
 * BSP (Business Solution Provider) Configuration
 */
export const bspConfig = {
  gupshup: {
    apiKey: process.env.GUPSHUP_API_KEY || '',
    appId: process.env.GUPSHUP_APP_ID || '',
    sourceNumber: process.env.GUPSHUP_SOURCE_NUMBER || '',
    partnerToken: process.env.GUPSHUP_PARTNER_TOKEN || '',
    partnerEmail: process.env.GUPSHUP_PARTNER_EMAIL || '',
    partnerPassword: process.env.GUPSHUP_PARTNER_PASSWORD || '',
    baseUrl: process.env.GUPSHUP_API_BASE_URL || 'https://api.gupshup.io',
    partnerBaseUrl: process.env.GUPSHUP_PARTNER_BASE_URL || 'https://partner.gupshup.io',
  },
  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    accessToken: process.env.META_ACCESS_TOKEN || '',
    version: 'v18.0',
  }
};
