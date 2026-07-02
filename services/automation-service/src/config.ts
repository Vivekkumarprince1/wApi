import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  JWT_SECRET: z.string({
    required_error: 'JWT_SECRET is required'
  }).min(1, 'JWT_SECRET cannot be empty'),
  INTERNAL_SERVICE_SECRET: z.string({
    required_error: 'INTERNAL_SERVICE_SECRET is required'
  }).min(1, 'INTERNAL_SERVICE_SECRET cannot be empty'),
  INTEGRATION_ENCRYPTION_KEY: z.string({
    required_error: 'INTEGRATION_ENCRYPTION_KEY is required'
  }).min(1, 'INTEGRATION_ENCRYPTION_KEY cannot be empty'),
});

const envParseResult = envSchema.safeParse(process.env);
if (!envParseResult.success) {
  console.error('❌ Environment validation failed for automation-service:');
  console.error(JSON.stringify(envParseResult.error.format(), null, 2));
  process.exit(1);
}

const jwtSecret = process.env.JWT_SECRET!;
const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET!;
const integrationEncryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY!;

if (process.env.NODE_ENV === 'production') {
  if (jwtSecret === 'your-secret-key-change-in-production' || jwtSecret === 'your-jwt-secret') {
    throw new Error('FATAL: A secure, non-default JWT_SECRET environment variable is required in production.');
  }
  if (internalServiceSecret === 'dev-internal-service-secret-change-me') {
    throw new Error('FATAL: A secure, non-default INTERNAL_SERVICE_SECRET environment variable is required in production.');
  }
  if (integrationEncryptionKey === 'change-me-in-production') {
    throw new Error('FATAL: A secure, non-default INTEGRATION_ENCRYPTION_KEY environment variable is required in production.');
  }
}

export const config = {
  jwtSecret,
  internalServiceSecret,
  chatServiceUrl: process.env.CHAT_SERVICE_URL || 'http://localhost:3008',
  contactServiceUrl: process.env.CONTACT_SERVICE_URL || 'http://localhost:3007',
  bspServiceUrl: process.env.BSP_SERVICE_URL || 'http://localhost:3004',
  integrationEncryptionKey,
};
