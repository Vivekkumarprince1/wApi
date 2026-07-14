import express from 'express';
import { Workspace, Permission, SystemSettings } from '../models/index.js';
import { extractToken, resolveUserFromToken } from '../utils/authHelper.js';
import { shouldBypassWorkspaceAccessGuard, getWorkspaceAccessDecision } from '../services/workspace-access-service.js';
import { extractInternalIdentityToken, verifyInternalIdentity } from '@wapi/contracts';
import config from '../config/index.js';

export interface AuthRequest extends express.Request {
  user?: any;
  workspace?: any;
  role?: string;
  permissions?: string[];
}

export const businessAuthMiddleware = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const internalToken = extractInternalIdentityToken(req.header('x-internal-auth'));
    if (internalToken) {
      const claims = verifyInternalIdentity(internalToken, config.internalServiceSecret, 'auth');
      req.user = await (await import('../models/index.js')).User.findById(claims.sub);
      if (!req.user) return res.status(401).json({ success: false, message: 'Internal identity user not found' });
      req.workspace = await Workspace.findById(claims.workspaceId);
      req.role = claims.workspaceRole;
      req.permissions = claims.permissions;
      return next();
    }
    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });

    const user = await resolveUserFromToken(token);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });

    // 1. Resolve Active Workspace Context
    let workspaceId = user.activeWorkspace || user.workspace;
    if (!workspaceId) {
      // Fallback: Resolve first available membership
      const firstMembership = await Permission.findOne({ user: user._id, isActive: { $ne: false } }).sort('createdAt');
      if (firstMembership) {
        workspaceId = firstMembership.workspace;
        user.activeWorkspace = workspaceId;
        await user.save();
      }
    }

    // Attach resolved auth user context to request
    req.user = user;

    // 3. System Maintenance Mode Check
    const settings = await SystemSettings.getSettings();
    if (settings.maintenanceMode && user.role !== 'super_admin') {
      return res.status(503).json({
        success: false,
        message: settings.maintenanceMessage || 'System is currently undergoing maintenance.',
        errorCode: 'MAINTENANCE_MODE'
      });
    }

    if (workspaceId) {
      // 2. Resolve Role and Permissions (Self-healing)
      let permission = await Permission.findOne({
        workspace: workspaceId,
        user: user._id,
        isActive: { $ne: false }
      });

      // Self-healing: If user is the workspace owner in User model but lacks Permission record, seed it.
      if (!permission && user.workspace?.toString() === workspaceId.toString()) {
        if (Permission.seedOwnerPermissions) {
          permission = await Permission.seedOwnerPermissions(workspaceId, user._id);
        }
      }

      const workspace = await Workspace.findById(workspaceId).populate('plan');
      if (workspace) {
        req.workspace = workspace;
        req.role = permission?.role || null;
        req.permissions = permission?.permissions || null;

        // 4. Workspace Access Guard (Billing & Onboarding)
        if (user.role !== 'super_admin' && !shouldBypassWorkspaceAccessGuard(req.originalUrl)) {
          const accessDecision = await getWorkspaceAccessDecision(user, workspace);
          if (accessDecision.accessRestriction) {
            const restriction = accessDecision.accessRestriction;
            return res.status(restriction.kind === 'billing' ? 402 : 403).json({
              success: false,
              message: restriction.description,
              accessRestriction: restriction,
              nextStep: accessDecision.nextStep,
              upgradeRequired: restriction.kind === 'billing',
              onboardingRequired: restriction.kind === 'onboarding'
            });
          }
        }
      }
    } else {
      if (user.role !== 'super_admin') {
        return res.status(400).json({ success: false, message: 'No active workspace context resolved' });
      }
    }

    next();
  } catch (error: any) {
    return res.status(401).json({ success: false, message: 'Unauthorized', error: error.message });
  }
};

/**
 * Middleware: Require one of the specified roles
 */
export const authorizeRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    if (req.user?.role === 'super_admin') return next();

    if (!req.role || !allowedRoles.includes(req.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to perform this action' });
    }
    next();
  };
};

/**
 * Middleware: Require super admin privileges
 */
export const isSuperAdmin = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Forbidden: Super admin privileges required' });
  }
  next();
};

/**
 * Middleware: Require workspace owner
 */
export const requireOwner = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  if (req.role !== 'owner' && req.user?.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Only workspace owners can perform this action',
      errorCode: 'OWNER_ONLY'
    });
  }
  next();
};

/**
 * Middleware: Require specific capability permission
 */
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    const hasPermission = req.permissions?.includes(permission) || req.role === 'owner' || req.user?.role === 'super_admin';
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Missing required permission: ${permission}`,
        errorCode: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    next();
  };
};
