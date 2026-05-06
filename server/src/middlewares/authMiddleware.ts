import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth-utils';
import { User, Workspace } from '../models';

export interface AuthRequest extends Request {
  user?: any;
  workspace?: any;
  role?: string;
  permissions?: string[];
  isImpersonating?: boolean;
  file?: any; // Added to support multer
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.auth_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided, authorization denied" });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Token is not valid" });
    }

    const user = await User.findById(decoded.id).select("-passwordHash");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Resolve Active Workspace
    let workspaceId = user.activeWorkspace || user.workspace;
    
    // We'll need to import Permission dynamically to avoid circular dependencies if any
    const { Permission } = await import("../models");
    
    if (!workspaceId) {
      const firstMembership = await Permission.findOne({ user: user._id }).sort('createdAt');
      if (firstMembership) {
        workspaceId = firstMembership.workspace;
        user.activeWorkspace = workspaceId;
        await User.findByIdAndUpdate(user._id, { activeWorkspace: workspaceId });
      }
    }

    let permission: any = null;
    let workspace: any = null;
    
    if (workspaceId) {
      permission = await Permission.findOne({ 
        workspace: workspaceId, 
        user: user._id,
        isActive: { $ne: false }
      });
      
      // Self-healing: If user is the owner (legacy field) but has no Permission record, seed it.
      if (!permission && user.workspace?.toString() === workspaceId.toString()) {
        if ((Permission as any).seedOwnerPermissions) {
          permission = await (Permission as any).seedOwnerPermissions(workspaceId, user._id);
        }
      }

      workspace = await Workspace.findById(workspaceId).populate('plan');
    }

    req.user = user;
    req.workspace = workspace;
    req.role = permission?.role || null;
    req.permissions = permission?.permissions || null;
    req.isImpersonating = !!decoded.isImpersonating;

    // WORKSPACE ACCESS GUARD (Billing & Onboarding)
    const { shouldBypassWorkspaceAccessGuard, getWorkspaceAccessDecision } = await import('../services/workspace-access-service');
    
    // Maintenance Mode Check
    const { SystemSettings } = await import('../models');
    const settings = await (SystemSettings as any).getSettings();
    if (settings.maintenanceMode && user.role !== 'super_admin') {
      return res.status(503).json({ 
        message: settings.maintenanceMessage || "System is under maintenance",
        errorCode: 'MAINTENANCE_MODE'
      });
    }

    if (!shouldBypassWorkspaceAccessGuard(req.originalUrl)) {
      const accessDecision = await getWorkspaceAccessDecision(user, workspace);
      if (accessDecision.accessRestriction) {
        const restriction = accessDecision.accessRestriction;
        return res.status(restriction.kind === 'billing' ? 402 : 403).json({
          message: restriction.description,
          accessRestriction: restriction,
          nextStep: accessDecision.nextStep,
          upgradeRequired: restriction.kind === 'billing',
          onboardingRequired: restriction.kind === 'onboarding'
        });
      }
    }

    next();
  } catch (err: any) {
    console.error("[Auth Middleware Error]:", err.message);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

export const authorizeRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role === 'super_admin') return next();
    
    if (!req.role || !allowedRoles.includes(req.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action" });
    }
    next();
  };
};

export const isSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ message: "Super admin access required" });
  }
  next();
};

/**
 * Require workspace owner access
 */
export const requireOwner = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.workspace) {
    return res.status(401).json({ message: "Workspace context required" });
  }

  if (req.role !== 'owner' && req.user?.role !== 'super_admin') {
    return res.status(403).json({ 
      message: "Only workspace owners can perform this action",
      errorCode: 'OWNER_ONLY'
    });
  }
  next();
};

/**
 * Verify workspace membership
 */
export const verifyWorkspaceMembership = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.workspace) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { Permission } = await import("../models");
    const permission = await Permission.findOne({
      workspace: req.workspace._id,
      user: req.user._id,
      isActive: true
    });

    if (!permission) {
      return res.status(403).json({ 
        message: "You are not a member of this workspace",
        errorCode: 'NOT_WORKSPACE_MEMBER'
      });
    }

    next();
  } catch (err: any) {
    console.error("[Workspace Membership Verification Error]:", err.message);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

/**
 * Check specific permission capability
 */
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.permissions?.includes(permission) && req.role !== 'owner' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ 
        message: `Permission required: ${permission}`,
        errorCode: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    next();
  };
};

/**
 * Workspace isolation helper - ensure resource belongs to user's workspace
 */
export const checkWorkspaceIsolation = async (
  req: AuthRequest,
  resourceQuery: any
): Promise<boolean> => {
  if (!req.workspace) {
    return false;
  }

  // Add workspace filter to query
  resourceQuery.workspace = req.workspace._id;
  return true;
};

/**
 * Rate limiting bypass for admin
 */
export const bypassRateLimitForAdmin = (req: AuthRequest) => {
  return req.role === 'owner' || req.role === 'admin' || req.user?.role === 'super_admin';
};

/**
 * Check if user is account owner
 */
export const checkOwner = async (req: AuthRequest, userId: string): Promise<boolean> => {
  if (!req.workspace) return false;

  const { Permission } = await import("../models");
  const permission = await Permission.findOne({
    workspace: req.workspace._id,
    user: userId
  });

  return permission?.role === 'owner';
};
