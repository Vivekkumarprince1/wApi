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
  adminId?: string; // Original admin ID if impersonating
  isImpersonating?: boolean;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT token for 30 days
 */
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
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
 * Standard Cookie Options for Auth Token
 */
export function getAuthCookieOptions() {
  const isProduction = config.env === 'production';
  
  return {
    name: 'auth_token',
    httpOnly: false,
    secure: isProduction || config.cookieSecure,
    sameSite: (isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds (Next.js cookies.set uses seconds)
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
