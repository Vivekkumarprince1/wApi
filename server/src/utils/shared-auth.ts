import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface TokenPayload {
  id: string;
  role: string;
  workspaceId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
  workspace?: {
    id: string;
  };
}

/**
 * Standardized Authentication Middleware for Microservices
 * 
 * Supports:
 * 1. Gateway Headers (x-user-id, x-workspace-id, x-user-role)
 * 2. Direct Bearer Token (for local testing)
 * 3. Cookie-based Token
 */
export const createAuthMiddleware = (jwtSecret: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // 1. Check Gateway Headers (Priority)
    const gatewayUserId = req.header('x-user-id');
    const gatewayWorkspaceId = req.header('x-workspace-id');
    const gatewayRole = req.header('x-user-role');

    if (gatewayUserId) {
      req.user = { 
        id: gatewayUserId, 
        role: gatewayRole || 'agent' 
      };
      if (gatewayWorkspaceId) {
        req.workspace = { id: gatewayWorkspaceId };
      }
      return next();
    }

    // 2. Fallback to JWT (Bearer or Cookie)
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : (req as any).cookies?.auth_token;

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authorization denied: No token or gateway headers provided' 
      });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
      req.user = { 
        id: decoded.id, 
        role: decoded.role || 'agent' 
      };
      if (decoded.workspaceId) {
        req.workspace = { id: decoded.workspaceId };
      }
      next();
    } catch (err) {
      res.status(401).json({ 
        success: false, 
        message: 'Token is not valid' 
      });
    }
  };
};

/**
 * Standardized Internal Service Auth
 */
export const createInternalAuthMiddleware = (internalSecret: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const secret = req.header('x-internal-service-secret');

    if (!secret || secret !== internalSecret) {
      console.warn(`[InternalAuth] Unauthorized access attempt: ${req.method} ${req.originalUrl}`);
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Internal service secret missing or invalid' 
      });
    }

    next();
  };
};
