import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * Middleware to verify that the request is coming from a trusted microservice.
 * Checks the x-internal-service-secret header.
 */
export const internalAuth = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.header('x-internal-service-secret');

  if (!secret) {
    console.warn(`[InternalAuth] Missing internal service secret from ${req.ip} (${req.method} ${req.originalUrl})`);
    return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Internal service secret missing or invalid' 
    });
  }

  if (secret !== config.internalServiceSecret) {
    console.warn(`[InternalAuth] Invalid internal service secret from ${req.ip} (${req.method} ${req.originalUrl})`);
    return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Internal service secret missing or invalid' 
    });
  }

  next();
};
