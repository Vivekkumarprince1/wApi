/**
 * FRONTEND CONFIGuration
 * Only contains safe, non-sensitive variables exposed to the client.
 */

export const config = {
  env: process.env.NODE_ENV || 'development',
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  // Empty means Socket.io uses the current origin. `next.config.ts` rewrites
  // /socket.io to the API gateway, so Docker/prod builds do not accidentally
  // bake a developer localhost into the browser bundle.
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || '',
  
  // Public Integration Keys (Safe for client)
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  facebookAppId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '',
  
  // Feature Flags
  businessVerificationMandatory: process.env.NEXT_PUBLIC_BUSINESS_VERIFICATION_MANDATORY === 'true',
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'ConnectSphare',
};

export default config;
