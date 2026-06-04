import dotenv from 'dotenv';
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
  mongodbUri:
    process.env.MONGO_URI ||
    process.env.MONGODB_URI_CAMPAIGN ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/wa_campaigns',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  billingServiceUrl: process.env.BILLING_SERVICE_URL || 'http://localhost:3003',
  bspServiceUrl: process.env.BSP_SERVICE_URL || 'http://localhost:3004',
  chatServiceUrl: process.env.CHAT_SERVICE_URL || 'http://localhost:3008',
  contactServiceUrl: process.env.CONTACT_SERVICE_URL || 'http://localhost:3007',
  apiGatewayUrl: process.env.API_GATEWAY_URL || 'http://localhost:5001',
  jwtSecret,
  internalServiceSecret,
};
