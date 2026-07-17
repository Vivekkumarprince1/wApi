import dotenv from 'dotenv';
import type { DotenvConfigOptions } from 'dotenv';
import { z } from 'zod';
import { validateSocialAuthPolicy } from './social-auth-policy.js';

dotenv.config({ quiet: true } as DotenvConfigOptions);

const envSchema = z.object({
  JWT_SECRET: z.string({
    required_error: 'JWT_SECRET is required',
  }).min(1, 'JWT_SECRET cannot be empty'),
  INTERNAL_SERVICE_SECRET: z.string({
    required_error: 'INTERNAL_SERVICE_SECRET is required',
  }).min(1, 'INTERNAL_SERVICE_SECRET cannot be empty'),
  NODE_ENV: z.string().optional().default('development'),
  GOOGLE_AUTH_ENABLED: z.enum(['true', 'false']).optional().default('false'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ALLOW_DEV_AUTH_MOCKS: z.enum(['true', 'false']).optional().default('false'),
});

const envParseResult = envSchema.safeParse(process.env);
if (!envParseResult.success) {
  console.error('Environment validation failed for auth-service:');
  console.error(JSON.stringify(envParseResult.error.format(), null, 2));
  process.exit(1);
}

const jwtSecret = process.env.JWT_SECRET!;
const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET!;
const socialAuthPolicy = validateSocialAuthPolicy({
  nodeEnv: process.env.NODE_ENV,
  googleAuthEnabled: process.env.GOOGLE_AUTH_ENABLED,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  allowDevAuthMocks: process.env.ALLOW_DEV_AUTH_MOCKS,
});
const businessVerificationProvider = String(process.env.BUSINESS_VERIFICATION_PROVIDER || 'hybrid').toLowerCase();

if (process.env.NODE_ENV === 'production') {
  if (businessVerificationProvider === 'mock') {
    throw new Error('FATAL: BUSINESS_VERIFICATION_PROVIDER=mock cannot be used in production.');
  }
  if (jwtSecret === 'your-secret-key-change-in-production') {
    throw new Error('FATAL: A secure, non-default JWT_SECRET environment variable is required in production.');
  }
  if (internalServiceSecret === 'dev-internal-service-secret-change-me') {
    throw new Error('FATAL: A secure, non-default INTERNAL_SERVICE_SECRET environment variable is required in production.');
  }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3006', 10),
  mongoUri: process.env.MONGO_URI || process.env.AUTH_MONGO_URI || 'mongodb://127.0.0.1:27017/wapi',
  jwtSecret,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  bspServiceUrl: process.env.BSP_SERVICE_URL || 'http://localhost:3004',
  billingServiceUrl: process.env.BILLING_SERVICE_URL || 'http://localhost:3003',
  internalServiceSecret,
  googleAuthEnabled: socialAuthPolicy.googleEnabled,
  allowDevAuthMocks: socialAuthPolicy.allowDevMocks,
  businessVerificationProvider,
  otpPepper: process.env.OTP_PEPPER || 'wapi-default-otp-pepper-key',
  smtpService: process.env.EMAIL_SERVICE || process.env.SMTP_SERVICE || '',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || process.env.EMAIL_USER || '',
  smtpPass: process.env.SMTP_PASS || process.env.EMAIL_PASS || '',
  smtpFrom: process.env.SMTP_FROM || process.env.EMAIL_FROM || 'noreply@WABA.com',
  bspOtpAppId: process.env.BSP_OTP_APP_ID || '',
  bspOtpTemplateName: process.env.BSP_OTP_TEMPLATE_NAME || '',
  msg91AuthKey: process.env.MSG91_AUTH_KEY || '',
  msg91OtpTemplateId: process.env.MSG91_OTP_TEMPLATE_ID || '',
  msg91SenderId: process.env.MSG91_SENDER_ID || '',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioSenderPhone: process.env.TWILIO_SENDER_PHONE || '',
  appName: process.env.APP_NAME || 'WABA',
  authCookieName: 'auth_token',
  authTokenTtl: '7d',
  authCookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  signupOtpTtlMinutes: parseInt(process.env.SIGNUP_OTP_TTL_MINUTES || '10', 10),
  devAllowOtpWithoutEmail:
    !process.env.NODE_ENV ||
    (process.env.NODE_ENV !== 'production' && (process.env.DEV_ALLOW_OTP_WITHOUT_EMAIL || 'true') === 'true'),
};

export type AppConfig = typeof config;

export default config;
