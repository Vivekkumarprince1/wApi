import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const serviceUrl = z.string().url().transform((url) => url.replace(/\/+$/, ''));

const configSchema = z.object({
  port: z.coerce.number().default(5001),
  jwtSecret: z.string().min(1, 'JWT_SECRET is required'),
  internalServiceSecret: z.string().min(1, 'INTERNAL_SERVICE_SECRET is required'),
  allowedOrigins: z
    .string()
    .default('http://localhost:3000,http://127.0.0.1:3000')
    .transform((str) => str.split(',')),
  coreServerUrl: serviceUrl.default('http://localhost:5005'),
  websocketServiceUrl: serviceUrl.default('http://localhost:5005'),
  automationServiceUrl: serviceUrl.default('http://localhost:3001'),
  campaignServiceUrl: serviceUrl.default('http://localhost:3002'),
  billingServiceUrl: serviceUrl.default('http://localhost:3003'),
});

const result = configSchema.safeParse({
  port: process.env.PORT,
  jwtSecret: process.env.JWT_SECRET,
  internalServiceSecret: process.env.INTERNAL_SERVICE_SECRET,
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  coreServerUrl: process.env.CORE_SERVER_URL,
  websocketServiceUrl: process.env.WEBSOCKET_SERVICE_URL || process.env.CORE_SERVER_URL,
  automationServiceUrl: process.env.AUTOMATION_SERVICE_URL,
  campaignServiceUrl: process.env.CAMPAIGN_SERVICE_URL,
  billingServiceUrl: process.env.BILLING_SERVICE_URL,
});

if (!result.success) {
  console.error('❌ Invalid API Gateway configuration:', result.error.format());
  process.exit(1);
}

export const config = result.data;
