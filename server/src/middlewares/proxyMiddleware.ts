import { Request, Response, NextFunction } from 'express';
import { proxyController } from '../controllers/proxyController';
import { AuthRequest } from './authMiddleware';

/**
 * Proxy Middleware Factory
 * 
 * Provides a clean interface for routing requests to microservices.
 */
export const proxyMiddleware = {
  /**
   * Returns a middleware that proxies the request to the specified service.
   * 
   * @param service - The target microservice name ('automation' | 'campaign' | 'billing')
   */
  proxyTo: (service: 'automation' | 'campaign' | 'billing') => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // We cast req to AuthRequest because the gateway expects authenticated context
        await proxyController.proxyTo(service, req as AuthRequest, res, next);
      } catch (error) {
        next(error);
      }
    };
  }
};
