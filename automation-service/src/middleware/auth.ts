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
 * Standardized Authentication Middleware
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  // 1. Check Gateway Headers (Priority)
  const gatewayUserId = req.header('x-user-id');
  const gatewayWorkspaceId = req.header('x-workspace-id');
  const gatewayRole = req.header('x-user-role');

  if (gatewayUserId) {
    req.user = { 
      id: gatewayUserId, 
      _id: gatewayUserId, // Compatibility with ObjectId checks
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

  // 2. Fallback to JWT
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
    const decoded: any = jwt.verify(token, JWT_SECRET);
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
    res.status(401).json({ 
      success: false, 
      message: 'Token is not valid' 
    });
  }
};

/**
 * Role-based Authorization
 */
export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        message: 'Permission denied: You do not have the required role' 
      });
    }
    next();
  };
};

/**
 * Internal Service Authentication
 */
export const internalAuth = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.header('x-internal-service-secret');

  if (!secret || secret !== INTERNAL_SECRET) {
    console.warn(`[Automation InternalAuth] Unauthorized access from ${req.ip} to ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ 
      success: false,
      message: 'Unauthorized: Internal service secret missing or invalid' 
    });
  }

  next();
};
