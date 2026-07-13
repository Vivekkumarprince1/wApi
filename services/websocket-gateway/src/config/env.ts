import dotenv from 'dotenv';
import type { DotenvConfigOptions } from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true } as DotenvConfigOptions);

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3100',
  'http://127.0.0.1:3100',
];

const envSchema = z.object({
  JWT_SECRET: z.string({
    required_error: 'JWT_SECRET is required',
  }).min(1, 'JWT_SECRET cannot be empty'),
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  MONGO_URI: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  REDIS_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  AUTH_SERVICE_URL: z.string().optional(),
  AUTH_SERVICE_TIMEOUT_MS: z.string().optional(),
});

const envParseResult = envSchema.safeParse(process.env);
if (!envParseResult.success) {
  console.error('Environment validation failed for websocket-gateway:');
  console.error(JSON.stringify(envParseResult.error.format(), null, 2));
  process.exit(1);
}

const jwtSecret = process.env.JWT_SECRET!;

if (process.env.NODE_ENV === 'production') {
  if (
    jwtSecret === 'your-secret-key-change-in-production' ||
    jwtSecret === 'your-jwt-secret' ||
    jwtSecret === 'your-default-secret'
  ) {
    throw new Error('FATAL: A secure, non-default JWT_SECRET environment variable is required in production.');
  }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '3009', 10),
  mongoUri: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/wapi',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret,
  authServiceUrl: process.env.AUTH_SERVICE_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3006'),
  authServiceTimeoutMs: parseInt(process.env.AUTH_SERVICE_TIMEOUT_MS || '2000', 10),
  allowedOrigins: (process.env.ALLOWED_ORIGINS?.split(',') || defaultAllowedOrigins)
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export type AppConfig = typeof config;

export default config;
