import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const JWT_SECRET = config.jwtSecret;
const INTERNAL_SECRET = config.internalServiceSecret;

export interface AuthRequest extends Request {
  user?: any;
  workspace?: any;
  role?: string;
  permissions?: string[];
}

/**
 * Middleware to handle authentication.
 * Supports both direct JWT verification and Header-based Auth (from Gateway).
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  // 1. Check for Gateway Headers (Standard for Microservices)
  const gatewayUserId = req.header('x-user-id');
  const gatewayWorkspaceId = req.header('x-workspace-id');
  const gatewayRole = req.header('x-user-role');

  if (gatewayUserId) {
    req.user = { 
      id: gatewayUserId, 
      _id: gatewayUserId,
      role: gatewayRole || 'agent' 
    };
    req.role = gatewayRole || 'agent';
    
    if (gatewayWorkspaceId) {
      req.workspace = { 
        id: gatewayWorkspaceId,
        _id: gatewayWorkspaceId
      };
    }
    return next();
  }

  // 2. Fallback: Direct JWT Verification
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!token) {
    return res.status(401).json({ message: 'Authorization denied: No token or headers provided' });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET as string);
    req.user = { 
      id: decoded.id, 
      _id: decoded.id,
      role: decoded.role || 'agent' 
    };
    req.role = decoded.role || 'agent';
    
    if (decoded.workspaceId) {
      req.workspace = { 
        id: decoded.workspaceId,
        _id: decoded.workspaceId
      };
    }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

/**
 * Middleware to restrict access by role.
 */
export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Permission denied: You do not have the required role' 
      });
    }
    next();
  };
};

/**
 * Middleware for secure inter-service communication.
 */
export const internalAuth = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.header('x-internal-service-secret');

  if (!secret) {
    console.warn(`[Campaign InternalAuth] Missing secret for ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: 'Unauthorized: Internal service secret missing or invalid' });
  }

  if (secret !== INTERNAL_SECRET) {
    console.warn(`[Campaign InternalAuth] Invalid secret for ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: 'Unauthorized: Internal service secret missing or invalid' });
  }

  next();
};
