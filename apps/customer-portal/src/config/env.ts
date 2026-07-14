import { z } from 'zod';

const publicEnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXT_PUBLIC_API_URL: z.string().optional(),
  NEXT_PUBLIC_SOCKET_URL: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: z.string().optional(),
  NEXT_PUBLIC_FACEBOOK_APP_ID: z.string().optional(),
  NEXT_PUBLIC_FACEBOOK_AUTH_ENABLED: z.string().optional(),
  NEXT_PUBLIC_BUSINESS_VERIFICATION_MANDATORY: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
});

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED,
  NEXT_PUBLIC_FACEBOOK_APP_ID: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
  NEXT_PUBLIC_FACEBOOK_AUTH_ENABLED: process.env.NEXT_PUBLIC_FACEBOOK_AUTH_ENABLED,
  NEXT_PUBLIC_BUSINESS_VERIFICATION_MANDATORY: process.env.NEXT_PUBLIC_BUSINESS_VERIFICATION_MANDATORY,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
};

const envParseResult = publicEnvSchema.safeParse(rawEnv);
if (!envParseResult.success) {
  console.error('Environment validation failed for customer-portal:');
  console.error(JSON.stringify(envParseResult.error.format(), null, 2));
}

export const config = {
  env: rawEnv.NODE_ENV || 'development',
  baseUrl: rawEnv.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiUrl: rawEnv.NEXT_PUBLIC_API_URL || '/api',
  // Empty means Socket.io uses the current origin. `next.config.ts` rewrites
  // /socket.io to the API gateway, so Docker/prod builds do not accidentally
  // bake a developer localhost into the browser bundle.
  socketUrl: rawEnv.NEXT_PUBLIC_SOCKET_URL || '',
  googleClientId: rawEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  googleAuthEnabled: rawEnv.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true',
  facebookAppId: rawEnv.NEXT_PUBLIC_FACEBOOK_APP_ID || '',
  facebookAuthEnabled: rawEnv.NEXT_PUBLIC_FACEBOOK_AUTH_ENABLED === 'true',
  businessVerificationMandatory: rawEnv.NEXT_PUBLIC_BUSINESS_VERIFICATION_MANDATORY === 'true',
  appName: rawEnv.NEXT_PUBLIC_APP_NAME || 'ConnectSphare',
};

export type PublicConfig = typeof config;

export default config;
