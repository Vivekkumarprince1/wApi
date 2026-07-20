import dotenv from 'dotenv';
import type { DotenvConfigOptions } from 'dotenv';
import { z } from 'zod';
import { resolveWebhookSignaturePolicy } from './webhook-policy.js';

dotenv.config({ quiet: true } as DotenvConfigOptions);

const envSchema = z.object({
  WEBHOOK_SECRET: z.string({
    required_error: 'WEBHOOK_SECRET is required',
  }).min(1, 'WEBHOOK_SECRET cannot be empty'),
  INTERNAL_SERVICE_SECRET: z.string({
    required_error: 'INTERNAL_SERVICE_SECRET is required',
  }).min(1, 'INTERNAL_SERVICE_SECRET cannot be empty'),
  WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  VERIFY_TOKEN: z.string().optional(),
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  MONGO_URI: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  REDIS_URL: z.string().optional(),
  REQUIRE_WEBHOOK_SIGNATURE: z.string().optional(),
  GUPSHUP_REQUIRE_WEBHOOK_SIGNATURE: z.string().optional(),
  ALLOW_UNSIGNED_DEV_WEBHOOKS: z.string().optional(),
  GUPSHUP_WEBHOOK_SECRET: z.string().optional(),
  META_WEBHOOK_SECRET: z.string().optional(),
}).refine((data) => data.WEBHOOK_VERIFY_TOKEN || data.VERIFY_TOKEN, {
  message: 'Either WEBHOOK_VERIFY_TOKEN or VERIFY_TOKEN must be provided',
  path: ['WEBHOOK_VERIFY_TOKEN'],
});

const envParseResult = envSchema.safeParse(process.env);
if (!envParseResult.success) {
  console.error('Environment validation failed for webhook-ingestor:');
  console.error(JSON.stringify(envParseResult.error.format(), null, 2));
  process.exit(1);
}

const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET!;
const signaturePolicy = resolveWebhookSignaturePolicy({
  nodeEnv: process.env.NODE_ENV,
  requireSignature: process.env.REQUIRE_WEBHOOK_SIGNATURE || process.env.GUPSHUP_REQUIRE_WEBHOOK_SIGNATURE,
  allowUnsignedDevWebhooks: process.env.ALLOW_UNSIGNED_DEV_WEBHOOKS,
});

if (process.env.NODE_ENV === 'production') {
  if (internalServiceSecret === 'dev-internal-service-secret-change-me') {
    throw new Error('FATAL: A secure, non-default INTERNAL_SERVICE_SECRET environment variable is required in production.');
  }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '3013', 10),
  webhookSecret: process.env.WEBHOOK_SECRET!,
  webhookSecrets: {
    gupshup: process.env.GUPSHUP_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET!,
    meta: process.env.META_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET!,
  },
  requireWebhookSignature: signaturePolicy.requireSignature,
  allowUnsignedDevWebhooks: signaturePolicy.allowUnsignedDevWebhooks,
  redisUrl: process.env.REDIS_URL || '',
  redisTopic: 'raw-webhook-events',
  internalServiceSecret,
  mongoUri: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wapi',
  deadLetterCollection: 'webhook_dead_letters',
  verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || process.env.VERIFY_TOKEN || '',
};

export type AppConfig = typeof config;

export default config;
