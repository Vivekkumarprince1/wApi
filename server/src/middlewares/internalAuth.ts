import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';

/**
 * Middleware to verify that the request is coming from a trusted microservice.
 * Uses constant-time compare for the shared secret so a rapid attacker can't
 * extract the value via response-timing side channels.
 */
export const internalAuth = (req: Request, res: Response, next: NextFunction) => {
  const provided = req.header('x-internal-service-secret') || '';
  const expected = config.internalServiceSecret || '';

  const providedBuf = Buffer.from(provided, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  const ok =
    expectedBuf.length > 0 &&
    providedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!ok) {
    console.warn(`[InternalAuth] Rejecting internal request from ${req.ip} (${req.method} ${req.originalUrl})`);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Internal service secret missing or invalid'
    });
  }

  next();
};
