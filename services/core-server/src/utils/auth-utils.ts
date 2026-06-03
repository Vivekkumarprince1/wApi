/**
 * AUTH UTILITIES
 * JWT signing/verification and standardized cookie handling.
 * Parity with legacy backend/controllers/auth/authController.js (sendAuthToken)
 */

import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { config } from '../config';

export interface TokenPayload {
  id: string;
  workspaceId?: string;
  role?: string;
  adminId?: string; // Original admin ID if impersonating
  isImpersonating?: boolean;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT token. Default lifetime is 7 days; override with
 * `AUTH_TOKEN_TTL` env var (e.g. `2h`, `24h`, `7d`). Long-lived 30-day
 * tokens combined with non-httpOnly cookies were a large XSS blast radius.
 */
export function signToken(payload: TokenPayload): string {
  const expiresIn = (process.env.AUTH_TOKEN_TTL || '7d') as any;
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch (err) {
    return null;
  }
}

/**
 * Standard Cookie Options for Auth Token. httpOnly so JS cannot read the
 * cookie (XSS-stealable token was the previous default). The socket
 * handshake should rely on the dedicated session endpoint to obtain a
 * short-lived token rather than reading this cookie directly.
 */
export function getAuthCookieOptions() {
  const isProduction = config.env === 'production';

  return {
    name: 'auth_token',
    httpOnly: true,
    secure: isProduction || config.cookieSecure,
    sameSite: (isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds, matches default JWT TTL
    path: '/',
  };
}

/**
 * Helper to append auth cookie to a NextResponse (for App Router)
 */
export function setAuthCookie(response: NextResponse, token: string) {
  const options = getAuthCookieOptions();
  
  response.cookies.set(options.name, token, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    maxAge: options.maxAge,
    path: options.path,
  });
  
  return response;
}

/**
 * Helper to clear auth cookie from a NextResponse
 */
export function clearAuthCookie(response: NextResponse) {
  response.cookies.set('auth_token', '', { maxAge: 0, path: '/' });
  return response;
}
