import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { ForbiddenError } from '../utils/errors';

/**
 * Middleware to require a specific permission for a workspace action
 */
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // 1. Super admin always has access
    if (req.user?.role === 'super_admin') return next();

    // 2. Owners have all permissions within their workspace
    if (req.role === 'owner') return next();

    // 3. Check specific permissions
    const userPermissions = req.permissions || [];
    if (userPermissions.includes(permission)) {
      return next();
    }

    // 4. Default deny
    next(new ForbiddenError(`Permission required: ${permission}`));
  };
};

/**
 * Middleware to require a specific role for a workspace action
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role === 'super_admin') return next();

    if (!req.role || !allowedRoles.includes(req.role)) {
      return next(new ForbiddenError(`Required role: ${allowedRoles.join(' or ')}`));
    }
    next();
  };
};
