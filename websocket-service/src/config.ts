import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

// Look for a local .env first, then fallback to core server's .env for easy local development
const localEnvPath = path.resolve(process.cwd(), '.env');
const fallbackEnvPath = path.resolve(process.cwd(), '../server/.env');

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else if (fs.existsSync(fallbackEnvPath)) {
  dotenv.config({ path: fallbackEnvPath });
  console.log(`\x1b[36m[Config] Local .env not found. Loaded shared environment from core server: ${fallbackEnvPath}\x1b[0m`);
} else {
  dotenv.config();
}

const configSchema = z.object({
  port: z.coerce.number().default(4000),
  redisUrl: z.string().url().default('redis://localhost:6379'),
  jwtSecret: z.string().min(1, 'JWT_SECRET is required'),
  coreServerUrl: z.string().url().default('http://localhost:5005'),
  internalServiceSecret: z.string().min(1, 'INTERNAL_SERVICE_SECRET is required'),
  allowedOrigins: z
    .string()
    .default('http://localhost:3000,http://localhost:3001')
    .transform((str) => str.split(',')),
});

const result = configSchema.safeParse({
  port: process.env.PORT || process.env.WEBSOCKET_PORT,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  coreServerUrl: process.env.CORE_SERVER_URL,
  internalServiceSecret: process.env.INTERNAL_SERVICE_SECRET,
  allowedOrigins: process.env.ALLOWED_ORIGINS,
});

if (!result.success) {
  console.error('❌ Invalid WebSocket Service configuration:', result.error.format());
  process.exit(1);
}

export const config = result.data;
