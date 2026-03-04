/**
 * ENVIRONMENT VALIDATION
 * Validates and provides typed access to environment variables
 */

const logger = require('../utils/logger');

const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'REDIS_URL'
];

const optionalEnvVars = {
  // Database
  MONGO_URI: null,
  DB_NAME: 'wapi_development',
  DB_USER: null,
  DB_PASS: null,
  DB_HOST: 'localhost',
  DB_PORT: '27017',

  // External APIs
  GUPSHUP_APP_ID: null,
  GUPSHUP_APP_SECRET: null,
  GUPSHUP_PARTNER_TOKEN: null,

  // Email
  SMTP_HOST: null,
  SMTP_PORT: '587',
  SMTP_USER: null,
  SMTP_PASS: null,

  // File Storage
  CLOUDINARY_CLOUD_NAME: null,
  CLOUDINARY_API_KEY: null,
  CLOUDINARY_API_SECRET: null,

  // Payment
  STRIPE_SECRET_KEY: null,
  STRIPE_WEBHOOK_SECRET: null,

  // Logging
  LOG_LEVEL: 'info',

  // Security
  CORS_ORIGIN: '*',
  API_KEY_SALT: 'default-salt-change-in-production',

  // Features
  ENABLE_AUTOMATION_ENGINE: 'true',
  START_WEBHOOK_WORKER: 'true',
  START_MESSAGE_RETRY_WORKER: 'true'
};

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const missing = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    const error = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(error);
    throw new Error(error);
  }

  // Validate specific formats
  validateEncryptionKey();
  validateJwtSecret();

  logger.info('Environment validation passed');
}

/**
 * Validate encryption key format
 */
function validateEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hexadecimal string (256 bits)');
  }
}

/**
 * Validate JWT secret strength
 */
function validateJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length < 32) {
    logger.warn('JWT_SECRET is shorter than recommended (32 characters minimum)');
  }
}

/**
 * Get typed environment variable
 */
function getEnv(key, defaultValue = null) {
  const value = process.env[key];

  if (value === undefined || value === null) {
    if (defaultValue !== null) {
      return defaultValue;
    }
    return optionalEnvVars[key] || null;
  }

  return value;
}

/**
 * Get boolean environment variable
 */
function getEnvBool(key, defaultValue = false) {
  const value = getEnv(key);
  if (value === null) return defaultValue;

  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Get number environment variable
 */
function getEnvNumber(key, defaultValue = 0) {
  const value = getEnv(key);
  if (value === null) return defaultValue;

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get array environment variable (comma-separated)
 */
function getEnvArray(key, defaultValue = []) {
  const value = getEnv(key);
  if (value === null) return defaultValue;

  return value.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * Environment configuration object
 */
const env = {
  // Node environment
  NODE_ENV: getEnv('NODE_ENV'),
  isDevelopment: getEnv('NODE_ENV') === 'development',
  isProduction: getEnv('NODE_ENV') === 'production',
  isTest: getEnv('NODE_ENV') === 'test',

  // Server
  PORT: getEnvNumber('PORT', 5000),

  // Security
  JWT_SECRET: getEnv('JWT_SECRET'),
  ENCRYPTION_KEY: getEnv('ENCRYPTION_KEY'),
  API_KEY_SALT: getEnv('API_KEY_SALT'),

  // Database
  MONGO_URI: getEnv('MONGO_URI'),
  DB_NAME: getEnv('DB_NAME'),
  DB_USER: getEnv('DB_USER'),
  DB_PASS: getEnv('DB_PASS'),
  DB_HOST: getEnv('DB_HOST'),
  DB_PORT: getEnvNumber('DB_PORT', 27017),

  // Redis
  REDIS_URL: getEnv('REDIS_URL'),

  // External APIs
  GUPSHUP_APP_ID: getEnv('GUPSHUP_APP_ID'),
  GUPSHUP_APP_SECRET: getEnv('GUPSHUP_APP_SECRET'),
  GUPSHUP_PARTNER_TOKEN: getEnv('GUPSHUP_PARTNER_TOKEN'),

  // Email
  SMTP_HOST: getEnv('SMTP_HOST'),
  SMTP_PORT: getEnvNumber('SMTP_PORT', 587),
  SMTP_USER: getEnv('SMTP_USER'),
  SMTP_PASS: getEnv('SMTP_PASS'),

  // File Storage
  CLOUDINARY_CLOUD_NAME: getEnv('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: getEnv('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: getEnv('CLOUDINARY_API_SECRET'),

  // Payment
  STRIPE_SECRET_KEY: getEnv('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: getEnv('STRIPE_WEBHOOK_SECRET'),

  // Logging
  LOG_LEVEL: getEnv('LOG_LEVEL'),

  // Security
  CORS_ORIGIN: getEnvArray('CORS_ORIGIN', ['http://localhost:3000']),

  // Features
  ENABLE_AUTOMATION_ENGINE: getEnvBool('ENABLE_AUTOMATION_ENGINE', true),
  START_WEBHOOK_WORKER: getEnvBool('START_WEBHOOK_WORKER', true),
  START_MESSAGE_RETRY_WORKER: getEnvBool('START_MESSAGE_RETRY_WORKER', true),

  // URLs
  FRONTEND_URL: getEnv('FRONTEND_URL'),
  API_BASE_URL: getEnv('API_BASE_URL')
};

module.exports = {
  validateEnvironment,
  env,
  getEnv,
  getEnvBool,
  getEnvNumber,
  getEnvArray
};