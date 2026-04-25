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
  // Gupshup WhatsApp API credentials
  whatsappToken: process.env.GUPSHUP_API_KEY || '',
  whatsappPhoneId: process.env.GUPSHUP_SOURCE_NUMBER || '',
  metaAppId: process.env.GUPSHUP_APP_ID || '',
  metaAppSecret: process.env.GUPSHUP_PARTNER_TOKEN || '',
  metaWabaId: process.env.GUPSHUP_APP_ID || '',
  metaVerifyToken: '',
  // Embedded onboarding configuration
  metaConfigId: process.env.GUPSHUP_APP_ID || '',
  metaBusinessId: process.env.GUPSHUP_APP_ID || ''
};
