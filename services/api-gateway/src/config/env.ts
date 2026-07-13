import dotenv from 'dotenv';
import type { DotenvConfigOptions } from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true } as DotenvConfigOptions);

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  INTERNAL_SERVICE_SECRET: z.string({
    required_error: 'INTERNAL_SERVICE_SECRET is required',
  }).min(1, 'INTERNAL_SERVICE_SECRET cannot be empty'),
  BACKEND_PORT: z.string().optional(),
  PORT: z.string().optional(),
  REDIS_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  AUTH_SERVICE_URL: z.string().optional(),
  CONTACT_SERVICE_URL: z.string().optional(),
  CHAT_SERVICE_URL: z.string().optional(),
  SERVICE_PROVIDER_URL: z.string().optional(),
  BSP_SERVICE_URL: z.string().optional(),
  AUTOMATION_SERVICE_URL: z.string().optional(),
  BILLING_SERVICE_URL: z.string().optional(),
  CAMPAIGN_SERVICE_URL: z.string().optional(),
  WEBSOCKET_URL: z.string().optional(),
  WEBHOOK_INGESTOR_URL: z.string().optional(),
});

const envParseResult = envSchema.safeParse(process.env);
if (!envParseResult.success) {
  console.error('Environment validation failed for api-gateway:');
  console.error(JSON.stringify(envParseResult.error.format(), null, 2));
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';
const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET!;
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = rawAllowedOrigins
  ? rawAllowedOrigins.split(',').map((origin) => origin.trim()).filter(Boolean)
  : defaultAllowedOrigins;

if (isProduction) {
  const devSecrets = new Set([
    'dev-internal-service-secret-change-me',
    'your_internal_service_secret_here',
    'change-me-in-production',
  ]);

  if (devSecrets.has(internalServiceSecret) || internalServiceSecret.length < 32) {
    throw new Error('FATAL: A secure, non-default INTERNAL_SERVICE_SECRET with at least 32 characters is required in production.');
  }

  if (!rawAllowedOrigins || rawAllowedOrigins.includes('localhost') || rawAllowedOrigins.includes('127.0.0.1')) {
    throw new Error('FATAL: Production ALLOWED_ORIGINS must be explicit public HTTPS origins, not localhost defaults.');
  }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction,
  port: parseInt(process.env.BACKEND_PORT || process.env.PORT || '5001', 10),
  redisUrl: process.env.REDIS_URL || '',
  internalServiceSecret,
  allowedOrigins,
  corsOrigin: allowedOrigins.includes('*') ? true : allowedOrigins,
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3006',
    contact: process.env.CONTACT_SERVICE_URL || 'http://localhost:3007',
    chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3008',
    serviceProvider: process.env.SERVICE_PROVIDER_URL || process.env.BSP_SERVICE_URL || 'http://localhost:3004',
    automation: process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3001',
    billing: process.env.BILLING_SERVICE_URL || 'http://localhost:3003',
    campaign: process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:3002',
    websocket: process.env.WEBSOCKET_URL || 'http://localhost:3009',
    ingestor: process.env.WEBHOOK_INGESTOR_URL || 'http://localhost:3013',
  },
};

export type AppConfig = typeof config;

export default config;
