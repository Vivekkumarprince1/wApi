import type { Request } from 'express';

const FRONTEND_CALLBACK_PATH = '/auth/google/callback';
const BACKEND_CALLBACK_PATH = '/api/v1/auth/google/callback';

function clean(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function originFromUrl(value: string | undefined | null) {
  const input = clean(value);
  if (!input) return undefined;

  try {
    return new URL(input).origin;
  } catch {
    return undefined;
  }
}

function joinUrl(origin: string, path: string) {
  return `${origin.replace(/\/+$/, '')}${path}`;
}

function requestOrigin(req?: Request) {
  if (!req) return undefined;

  const origin = originFromUrl(req.headers.origin as string | undefined);
  if (origin) return { origin, source: 'request-origin' };

  const referer = originFromUrl(req.headers.referer as string | undefined);
  if (referer) return { origin: referer, source: 'request-referer' };

  return undefined;
}

function requestSelfOrigin(req?: Request) {
  if (!req) return undefined;

  const host = clean(req.get('x-forwarded-host') || req.get('host'));
  if (!host) return undefined;

  const forwardedProto = clean((req.get('x-forwarded-proto') || '').split(',')[0]);
  const proto = forwardedProto || req.protocol || 'https';

  return { origin: `${proto}://${host}`, source: 'request-host' };
}

export function resolveGoogleRedirectUri(req?: Request) {
  const explicit = clean(process.env.GOOGLE_REDIRECT_URI);
  if (explicit) return { redirectUri: explicit, source: 'GOOGLE_REDIRECT_URI' };

  const appOrigin =
    originFromUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    originFromUrl(process.env.APP_URL) ||
    originFromUrl(process.env.FRONTEND_URL);

  if (appOrigin) {
    return {
      redirectUri: joinUrl(appOrigin, FRONTEND_CALLBACK_PATH),
      source: process.env.NEXT_PUBLIC_APP_URL
        ? 'NEXT_PUBLIC_APP_URL'
        : process.env.APP_URL
          ? 'APP_URL'
          : 'FRONTEND_URL'
    };
  }

  const browserOrigin = requestOrigin(req);
  if (browserOrigin) {
    return {
      redirectUri: joinUrl(browserOrigin.origin, FRONTEND_CALLBACK_PATH),
      source: browserOrigin.source
    };
  }

  const selfOrigin = requestSelfOrigin(req);
  if (selfOrigin && process.env.NODE_ENV === 'production') {
    return {
      redirectUri: joinUrl(selfOrigin.origin, BACKEND_CALLBACK_PATH),
      source: selfOrigin.source
    };
  }

  return {
    redirectUri: joinUrl('http://localhost:3000', FRONTEND_CALLBACK_PATH),
    source: 'development-default'
  };
}
