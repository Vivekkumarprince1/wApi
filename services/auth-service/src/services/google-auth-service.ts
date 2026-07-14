import crypto from 'crypto';
import axios from 'axios';
import config from '../config/index.js';

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const resolveGoogleRedirectUri = (redirectUri?: string) => {
  if (redirectUri) {
    try {
      const parsed = new URL(redirectUri);
      if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.pathname === '/auth/google/callback') {
        return parsed.toString();
      }
    } catch {
      // Fall through to configured default.
    }
  }

  return process.env.GOOGLE_REDIRECT_URI || `${APP_URL()}/auth/google/callback`;
};

export const getGoogleAuthUrl = (type: string = 'login', redirectUri?: string) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const resolvedRedirectUri = resolveGoogleRedirectUri(redirectUri);

  if (!config.googleAuthEnabled) {
    throw Object.assign(new Error('Google authentication is disabled'), {
      status: 503,
      code: 'FEATURE_DISABLED',
    });
  }

  if (!clientId && config.allowDevAuthMocks) {
    const devCode = `dev-google-${Date.now()}`;
    return `${resolvedRedirectUri}?code=${encodeURIComponent(devCode)}&state=${encodeURIComponent(type)}`;
  }

  if (!clientId) {
    throw Object.assign(new Error('Google authentication provider is not configured'), {
      status: 503,
      code: 'PROVIDER_NOT_CONFIGURED',
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: resolvedRedirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    access_type: 'offline',
    prompt: 'consent',
    state: type
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const getGoogleUser = async (code: string, redirectUri?: string) => {
  if (!config.googleAuthEnabled) {
    throw Object.assign(new Error('Google authentication is disabled'), {
      status: 503,
      code: 'FEATURE_DISABLED',
    });
  }

  const isDevCode = String(code).startsWith('dev-google-');
  const credentialsMissing = !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET;
  const isDev = config.allowDevAuthMocks && (isDevCode || credentialsMissing);

  if (isDev) {
    const digest = crypto.createHash('sha1').update(String(code)).digest('hex').slice(0, 12);
    return {
      id: `mock-google-id-${digest}`,
      email: `google.${digest}@local.wapi`,
      name: `Google User ${digest.slice(0, 4)}`,
      picture: `https://avatar.vercel.sh/google-${digest}`
    };
  }

  if (isDevCode) {
    throw Object.assign(new Error('Development Google authorization codes are not accepted'), {
      status: 401,
      code: 'INVALID_OAUTH_CODE',
    });
  }

  if (credentialsMissing) {
    throw Object.assign(new Error('Google authentication provider is not configured'), {
      status: 503,
      code: 'PROVIDER_NOT_CONFIGURED',
    });
  }

  const resolvedRedirectUri = resolveGoogleRedirectUri(redirectUri);

  const tokenResponse = await axios.post(
    'https://oauth2.googleapis.com/token',
    {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: resolvedRedirectUri,
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
