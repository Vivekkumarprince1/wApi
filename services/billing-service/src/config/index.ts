import dotenv from 'dotenv';
import { resolveRedisUrl } from '@wapi/contracts';
dotenv.config();

const jwtSecret = process.env.JWT_SECRET || '';
const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET || '';

if (!jwtSecret) {
  throw new Error('FATAL: JWT_SECRET is required for billing-service.');
}

if (!internalServiceSecret) {
  throw new Error('FATAL: INTERNAL_SERVICE_SECRET is required for billing-service.');
}

export const config = {
  port: process.env.PORT || 3003,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/wapi_billing',
  redisUrl: resolveRedisUrl(),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  jwtSecret,
  internalServiceSecret,
};
