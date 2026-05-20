/**
 * AUTH MIDDLEWARE (HOC)
 * Protects Next.js Route Handlers by verifying JWT and populating user/workspace.
 * Parity with legacy backend/middlewares/auth.js
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/utils/auth-utils";
import dbConnect from "../db-connect";
import { User, Workspace } from "../models";
import { getWorkspaceAccessDecision, shouldBypassWorkspaceAccessGuard } from "@/services/workspace-access-service";
import type { AuthenticatedHandler, IAuthContext } from "@/types/auth";

export type { AuthenticatedHandler, IAuthContext };

/**
 * withAuth Higher-Order Function
 * Usage in route.ts: export const GET = withAuth(async (req: NextRequest, { user, workspace, isImpersonating }) => { ... })
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest, context: { params: any }) => {
    try {
      await dbConnect();

      // Next.js 16 can provide dynamic route params as a Promise.
      // Normalize once here so all wrapped handlers can safely read params synchronously.
      const resolvedParams = await Promise.resolve(context?.params);

      // Get token from cookies
      const token = req.cookies.get("auth_token")?.value;

      if (!token) {
        return NextResponse.json({ message: "No token provided, authorization denied" }, { status: 401 });
      }

      // Verify token
      const decoded = verifyToken(token);
      if (!decoded || !decoded.id) {
        return NextResponse.json({ message: "Token is not valid" }, { status: 401 });
      }

      // Find user and populate workspace
      const user = await User.findById(decoded.id).select("-passwordHash");
      if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 401 });
      }

      // MULTI-TENANCY: Resolve Active Workspace
      // 1. Prioritize activeWorkspace field
      // 2. Fallback to 'workspace' field for legacy
      // 3. Last fallback: find any Permission record for this user
      let workspaceId = user.activeWorkspace || user.workspace;
      
      const { Permission } = await import("../models");
      
      if (!workspaceId) {
        const firstMembership = await Permission.findOne({ user: user._id }).sort('createdAt');
        if (firstMembership) {
          workspaceId = firstMembership.workspace;
          // Sync back to user object for subsequent hits
          user.activeWorkspace = workspaceId;
          await User.findByIdAndUpdate(user._id, { activeWorkspace: workspaceId });
        }
      }

      if (!workspaceId) {
         // No active workspace and no memberships - this might be a new user in onboarding.
         // We allow the request but context.workspace will be null.
      }

      // Check if user has a valid membership (Permission) for this workspace
      let permission: any = null;
      let workspace: any = null;
      
      const isAuthApi = req.nextUrl.pathname.startsWith('/api/auth/');

      if (workspaceId) {
        permission = await Permission.findOne({ 
          workspace: workspaceId, 
          user: user._id,
          isActive: { $ne: false }
        });
        
        // Self-healing: If user is the owner (legacy field) but has no Permission record, seed it.
        if (!permission && user.workspace?.toString() === workspaceId.toString()) {
           permission = await (Permission as any).seedOwnerPermissions(workspaceId, user._id);
        }

        if (!permission && user.role !== 'super_admin' && !isAuthApi) {
          // If no active permission found, check if they were removed
          if (user.status === 'removed') {
             return NextResponse.json({ message: "Access denied: Your account has been removed from this workspace" }, { status: 403 });
          }
          
          return NextResponse.json({ message: "Access denied: You are not a member of this workspace" }, { status: 403 });
        }

        workspace = await Workspace.findById(workspaceId).populate('plan');
      }

      // Attach to context for the handler
      if (!shouldBypassWorkspaceAccessGuard(req.nextUrl.pathname)) {
        const accessDecision = await getWorkspaceAccessDecision(user, workspace || undefined);
        if (accessDecision.accessRestriction) {
          const restriction = accessDecision.accessRestriction;
          return NextResponse.json({
            message: restriction.description,
            accessRestriction: restriction,
            nextStep: accessDecision.nextStep,
            upgradeRequired: true
          }, { status: 402 });
        }
      }

      return handler(req, { 
        ...context, 
        params: resolvedParams, 
        user: user as any,
        workspace,
        role: permission?.role || null,
        permissions: permission?.permissions || null,
        isImpersonating: !!decoded.isImpersonating
      });

    } catch (err: any) {
      console.error("[withAuth Error]:", err.message);
      return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
    }
  };
}

/**
 * withRole Higher-Order Function
 * Usage in route.ts: export const POST = withRole(['owner', 'admin'], async (req, { user }) => { ... })
 */
export function withRole(allowedRoles: string[], handler: AuthenticatedHandler) {
  return withAuth(async (req, context) => {
    const { user, role: workspaceRole } = context;
    
    // MASTER BYPASS: super_admin can do everything
    if (user.role === 'super_admin') {
      return handler(req, context);
    }
    
    if (!workspaceRole || !allowedRoles.includes(workspaceRole)) {
      return NextResponse.json({ 
        message: "You do not have permission to perform this action in this workspace",
        requiredRoles: allowedRoles,
        currentRole: workspaceRole || 'none'
      }, { status: 403 });
    }
    
    return handler(req, context);
  });
}

/**
 * withFeature Higher-Order Function
 * Usage in route.ts: export const GET = withFeature('BULK_CAMPAIGN', async (req, { workspace }) => { ... })
 * Automatically includes withAuth logic.
 */
export function withFeature(featureSlug: string, handler: AuthenticatedHandler) {
  return withAuth(async (req, context) => {
    const { user, workspace } = context;
    
    // MASTER BYPASS: super_admin can do everything
    if (user.role === 'super_admin') {
      return handler(req, context);
    }

    // 1. Resolve features from populated plan
    const features = (workspace?.plan as any)?.features || (workspace as any)?.features || [];

    if (!features.includes(featureSlug) && !features.includes('ALL')) {
      return NextResponse.json({ 
        message: `Your current plan does not include the ${featureSlug} feature.`,
        requiredFeature: featureSlug,
        upgradeRequired: true
      }, { status: 403 });
    }

    return handler(req, context);
  });
}

/**
 * isSuperAdmin Higher-Order Function
 * Usage in route.ts: export const POST = isSuperAdmin(async (req, { user }) => { ... })
 */
export function isSuperAdmin(handler: AuthenticatedHandler) {
  return withAuth(async (req, context) => {
    const { user } = context;

    if (user?.role !== 'super_admin') {
      return NextResponse.json(
        {
          message: 'Super admin access required',
          requiredRole: 'super_admin',
          currentRole: user?.role || 'unknown'
        },
        { status: 403 }
      );
    }

    return handler(req, context);
  });
}

