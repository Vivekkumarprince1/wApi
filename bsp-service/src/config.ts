import 'dotenv/config';

const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET;

if (!internalServiceSecret) {
  throw new Error('FATAL: INTERNAL_SERVICE_SECRET is required for bsp-service.');
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3004', 10),
  mongodbUri: process.env.MONGODB_URI_BSP || process.env.MONGODB_URI || 'mongodb://localhost:27017/wapi_bsp',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  internalServiceSecret,
  mainServiceUrl: process.env.MAIN_SERVICE_URL || 'http://localhost:5001',
  campaignServiceUrl: process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:3002',
  billingServiceUrl: process.env.BILLING_SERVICE_URL || 'http://localhost:3003',
  gupshup: {
    partnerBaseUrl: process.env.GUPSHUP_PARTNER_BASE_URL || 'https://partner.gupshup.io',
    apiBaseUrl: process.env.GUPSHUP_API_BASE_URL || 'https://api.gupshup.io',
    partnerEmail: process.env.GUPSHUP_PARTNER_EMAIL || '',
    partnerPassword: process.env.GUPSHUP_PARTNER_PASSWORD || process.env.GUPSHUP_PARTNER_CLIENT_SECRET || '',
    partnerToken: process.env.GUPSHUP_PARTNER_TOKEN || '',
    webhookSecret: process.env.GUPSHUP_WEBHOOK_SECRET || '',
    verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
  },
};
