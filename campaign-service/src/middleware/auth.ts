import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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
 * Supports both direct JWT verification and Header-based Auth (from Gateway).
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  // 1. Check for Gateway Headers (Standard for Microservices)
  const gatewayUserId = req.header('x-user-id');
  const gatewayWorkspaceId = req.header('x-workspace-id');
  const gatewayRole = req.header('x-user-role');

  console.log(`[Auth] Incoming Headers - User: ${gatewayUserId}, Workspace: ${gatewayWorkspaceId}, Role: ${gatewayRole}`);

  if (gatewayUserId && gatewayWorkspaceId) {
    req.user = { id: gatewayUserId, role: gatewayRole || 'agent' };
    req.workspace = { id: gatewayWorkspaceId };
    return next();
  }

  // 2. Fallback: Direct JWT Verification
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!token) {
    return res.status(401).json({ message: 'Authorization denied: No token or headers provided' });
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
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
