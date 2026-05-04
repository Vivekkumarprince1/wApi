/**
 * FRONTEND CONFIGuration
 * Only contains safe, non-sensitive variables exposed to the client.
 */

export const config = {
  env: process.env.NODE_ENV || 'development',
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005',
  
  // Public Integration Keys (Safe for client)
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  facebookAppId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '',
  
  // Feature Flags
  businessVerificationMandatory: process.env.NEXT_PUBLIC_BUSINESS_VERIFICATION_MANDATORY === 'true',
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'wApi',
};

export default config;
