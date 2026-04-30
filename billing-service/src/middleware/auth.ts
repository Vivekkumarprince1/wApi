import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const JWT_SECRET = config.jwtSecret;
const INTERNAL_SECRET = config.internalServiceSecret;

// The startup check is handled by the config module, but we double-check here
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is required for billing-service.');
  process.exit(1);
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
  workspace?: {
    id: string;
  };
}

/**
 * Middleware to handle authentication.
 * Supports both Gateway Headers and Direct JWT.
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  // 1. Check for Gateway Headers
  const gatewayUserId = req.header('x-user-id');
  const gatewayWorkspaceId = req.header('x-workspace-id');
  const gatewayRole = req.header('x-user-role');

  if (gatewayUserId && gatewayWorkspaceId) {
    req.user = { id: gatewayUserId, role: gatewayRole || 'agent' };
    req.workspace = { id: gatewayWorkspaceId };
    return next();
  }

  // 2. Fallback: Direct JWT
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!token) {
    return res.status(401).json({ message: 'Authorization denied: No token or headers provided' });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role || 'agent' };
    if (decoded.workspaceId) {
      req.workspace = { id: decoded.workspaceId };
    }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

/**
 * Middleware for secure inter-service communication.
 */
export const internalAuth = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.header('x-internal-service-secret');

  if (!secret || secret !== INTERNAL_SECRET) {
    return res.status(401).json({ message: 'Unauthorized: Internal service secret missing or invalid' });
  }

  next();
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
