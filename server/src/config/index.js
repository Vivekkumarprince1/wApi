const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/wa_saas',
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  facebookAppId: process.env.FACEBOOK_APP_ID || '',
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || '',
  // Meta WhatsApp Cloud API credentials
  whatsappToken: process.env.META_ACCESS_TOKEN || '',
  whatsappPhoneId: process.env.META_PHONE_NUMBER_ID || '',
  metaAppId: process.env.META_APP_ID || '',
  metaAppSecret: process.env.META_APP_SECRET || '',
  metaWabaId: process.env.META_WABA_ID || '',
  metaVerifyToken: process.env.META_VERIFY_TOKEN || '',
  // Meta Embedded Signup Configuration
  metaConfigId: process.env.META_CONFIG_ID || '', // WhatsApp Embedded Signup Config ID
  metaBusinessId: process.env.META_BUSINESS_ID || '' // Your Meta Business ID
};
