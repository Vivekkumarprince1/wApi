import dotenv from 'dotenv';
import { resolveRedisUrl } from '@wapi/contracts';
dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET;

if (!jwtSecret) {
  throw new Error('FATAL: JWT_SECRET environment variable is required for campaign-service.');
}

if (!internalServiceSecret) {
  throw new Error('FATAL: INTERNAL_SERVICE_SECRET environment variable is required for campaign-service.');
}

export const config = {
  port: process.env.PORT || 3002,
  mongodbUri: process.env.MONGODB_URI_CAMPAIGN || 'mongodb://localhost:27017/wa_campaigns',
  redisUrl: resolveRedisUrl(),
  billingServiceUrl: process.env.BILLING_SERVICE_URL || 'http://localhost:3003',
  monolithUrl: process.env.MONOLITH_URL || 'http://localhost:3000',
  jwtSecret,
  internalServiceSecret,
};
