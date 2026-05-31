import 'dotenv/config';

/**
 * CONFIGuration
 * Centralized environment variable mapping with TypeScript safety.
 * Parity with legacy backend/config/index.js
 */

const _jwtSecret = process.env.JWT_SECRET;
if (!_jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is required in production.');
}

const _internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET;
if (!_internalServiceSecret) {
  throw new Error('FATAL: INTERNAL_SERVICE_SECRET environment variable is required.');
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/wa_saas',
  jwtSecret: _jwtSecret || 'dev-only-insecure-key-change-me',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000',
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000',
  
  // Auth & OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  facebookAppId: process.env.FACEBOOK_APP_ID || '',
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || '',
  
  // WhatsApp / Gupshup
  gupshupApiKey: process.env.GUPSHUP_API_KEY || '',
  // gupshupSourceNumber: process.env.GUPSHUP_SOURCE_NUMBER || '',
  // gupshupAppId: process.env.GUPSHUP_APP_ID || '',
  // gupshupPartnerToken: process.env.GUPSHUP_PARTNER_TOKEN || '',
  gupshupPartnerEmail: process.env.GUPSHUP_PARTNER_EMAIL || '',
  gupshupPartnerPassword: process.env.GUPSHUP_PARTNER_PASSWORD || process.env.GUPSHUP_PARTNER_CLIENT_SECRET || '',
  gupshupPartnerClientSecret: process.env.GUPSHUP_PARTNER_CLIENT_SECRET || '',
  gupshupPartnerBaseUrl: process.env.GUPSHUP_PARTNER_BASE_URL || 'https://partner.gupshup.io',
  gupshupApiBaseUrl: process.env.GUPSHUP_API_BASE_URL || 'https://api.gupshup.io',
  gupshupOtpTemplateName: process.env.GUPSHUP_OTP_TEMPLATE_NAME || '',
  gupshupDefaultRegion: process.env.GUPSHUP_DEFAULT_REGION || 'IN',
  whatsappWebhookUrl: process.env.WHATSAPP_WEBHOOK_URL || '',
  whatsappWebhookSecret: process.env.GUPSHUP_WEBHOOK_SECRET || '',
  whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',

  // OTP / communication
  otpPepper: process.env.OTP_PEPPER || '',
  msg91AuthKey: process.env.MSG91_AUTH_KEY || '',
  msg91OtpTemplateId: process.env.MSG91_OTP_TEMPLATE_ID || '',
  msg91SenderId: process.env.MSG91_SENDER_ID || '',
  
  // Twilio
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioSenderPhone: process.env.TWILIO_SENDER_PHONE || '',
  
  smtpService: process.env.SMTP_SERVICE || process.env.EMAIL_SERVICE || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || process.env.EMAIL_USER || '',
  smtpPass: process.env.SMTP_PASS || process.env.EMAIL_PASS || '',
  smtpFrom: process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || 'no-reply@wapi.local',
  businessVerificationMandatory: process.env.BUSINESS_VERIFICATION_MANDATORY === 'true',
  businessVerificationProvider: process.env.BUSINESS_VERIFICATION_PROVIDER || 'hybrid',
  cleartaxBaseUrl: process.env.CLEARTAX_BASE_URL || 'https://api.cleartax.in',
  cleartaxApiKey: process.env.CLEARTAX_API_KEY || '',
  karzaBaseUrl: process.env.KARZA_BASE_URL || 'https://api.karza.in',
  karzaApiKey: process.env.KARZA_API_KEY || '',
  karzaPanVerifyPath: process.env.KARZA_PAN_VERIFY_PATH || '/v3/pan/verify',
  karzaMsmeVerifyPath: process.env.KARZA_MSME_VERIFY_PATH || '/v3/msme/verify',
  integrationEncryptionKey: process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET || 'change-me-in-production',
  
  // Feature Flags / System
  skipRedis: process.env.SKIP_REDIS === 'true',
  cookieSecure: process.env.COOKIE_SECURE === 'true',

  // Payments
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'razorpay_secret_123',

  // Cloudinary
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',

  // Microservices
  billingServiceUrl: process.env.BILLING_SERVICE_URL || 'http://localhost:3003',
  campaignServiceUrl: process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:3002',
  automationServiceUrl: process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3001',
  internalServiceSecret: _internalServiceSecret,

  appName: process.env.NEXT_PUBLIC_APP_NAME || 'wApi',
};

export default config;
