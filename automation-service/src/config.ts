import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET;

if (!jwtSecret) {
  throw new Error('FATAL: JWT_SECRET environment variable is required for automation-service.');
}

if (!internalServiceSecret) {
  throw new Error('FATAL: INTERNAL_SERVICE_SECRET environment variable is required for automation-service.');
}

export const config = {
  jwtSecret,
  internalServiceSecret,
  chatServiceUrl: process.env.CHAT_SERVICE_URL || 'http://localhost:3008',
  bspServiceUrl: process.env.BSP_SERVICE_URL || 'http://localhost:3004',
  integrationEncryptionKey: process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET || 'change-me-in-production',
};
