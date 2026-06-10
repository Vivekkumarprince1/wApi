import crypto from 'crypto';
import axios from 'axios';

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

export const getGoogleAuthUrl = (type: string = 'login') => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${APP_URL()}/auth/google/callback`;

  if (!clientId) {
    const devCode = `dev-google-${Date.now()}`;
    return `${APP_URL()}/auth/google/callback?code=${encodeURIComponent(devCode)}&state=${encodeURIComponent(type)}`;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    access_type: 'offline',
    prompt: 'consent',
    state: type
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const getGoogleUser = async (code: string) => {
  const isDev = String(code).startsWith('dev-google-') || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET;

  if (isDev) {
    const digest = crypto.createHash('sha1').update(String(code)).digest('hex').slice(0, 12);
    return {
      id: `mock-google-id-${digest}`,
      email: `google.${digest}@local.wapi`,
      name: `Google User ${digest.slice(0, 4)}`,
      picture: `https://avatar.vercel.sh/google-${digest}`
    };
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${APP_URL()}/auth/google/callback`;

  const tokenResponse = await axios.post(
    'https://oauth2.googleapis.com/token',
    {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    },
    { timeout: 10000 }
  );

  const accessToken = tokenResponse.data?.access_token;
  if (!accessToken) {
    throw Object.assign(new Error('Google did not return an access token'), { status: 502 });
  }

  const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000
  });

  return {
    id: userResponse.data?.id,
    email: userResponse.data?.email,
    name: userResponse.data?.name,
    picture: userResponse.data?.picture
  };
};
