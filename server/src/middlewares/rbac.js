/**
 * RBAC Middleware
 * Enforces role-based access control
 */

const Permission = require('../models/Permission');
const User = require('../models/User');

/**
 * Check if user has specific permission
 */
function requirePermission(permissionKey) {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id;
      const workspaceId = req.user?.workspace;

      if (!userId || !workspaceId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      // Get permission record
      let permission = await Permission.findOne({
        workspace: workspaceId,
        user: userId
      }).lean();

      // If no permission record exists, create default based on user role
      if (!permission) {
        const user = await User.findById(userId).select('role').lean();
        const role = user?.role || 'viewer';

        const defaultPermissions = Permission.schema.statics.getDefaultPermissions(role);

        permission = {
          role,
          permissions: defaultPermissions,
          isActive: true
        };

        // Create record in background (don't await)
        Permission.create({
          workspace: workspaceId,
          user: userId,
          role,
          permissions: defaultPermissions,
          isActive: true
        }).catch(err => console.error('[RBAC] Failed to create permission record:', err.message));
      }

      // Check if user is active
      if (permission.isActive === false) {
        return res.status(403).json({
          success: false,
          message: 'User account is disabled',
          code: 'ACCOUNT_DISABLED'
        });
      }

      // Owners bypass all permission checks
      if (permission.role === 'owner') {
        req.permissions = permission;
        return next();
      }

      // Check specific permission
      if (permission.permissions[permissionKey] !== true) {
        return res.status(403).json({
          success: false,
          message: `Permission denied: ${permissionKey}`,
          code: 'PERMISSION_DENIED',
          requiredPermission: permissionKey,
          role: permission.role
        });
      }

      // Attach permissions to request for downstream use
      req.permissions = permission;
      next();
    } catch (err) {
      console.error('[RBAC] Permission check failed:', err.message);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
        code: 'RBAC_ERROR'
      });
    }
  };
}

/**
 * Filter results based on agent restrictions
 * Used to apply tag/phone filters for agents
 */
function applyAgentRestrictions(query, permission) {
  if (!permission) return query;

  // Owners see everything
  if (permission.role === 'owner') return query;

  // Agents only see assigned tags/phones
  if (permission.role === 'agent') {
    if (permission.assignedTags && permission.assignedTags.length > 0) {
      query.tags = { $in: permission.assignedTags };
    }

    if (permission.assignedPhones && permission.assignedPhones.length > 0) {
      query.phone = { $in: permission.assignedPhones };
    }
  }

  return query;
}

/**
 * Check if user can view specific resource
 */async function canViewResource(userId, workspaceId, resourceType, resourceId) {
  try {
    const permission = await Permission.findOne({
      workspace: workspaceId,
      user: userId
    }).lean();

    if (!permission) return false;
    if (permission.role === 'owner') return true;

    const viewPermissionKey = `view${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`;
    return permission.permissions[viewPermissionKey] === true;
  } catch (err) {
    console.error('[RBAC] Resource check failed:', err.message);
    return false;
  }
}

module.exports = {
  requirePermission,
  applyAgentRestrictions,
  canViewResource
};
