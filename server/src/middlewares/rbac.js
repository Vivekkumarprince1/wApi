/**
 * RBAC Middleware - Stage 4 Implementation
 * Enforces role-based access control for Shared Inbox & Agent Roles
 * 
 * Roles: OWNER, MANAGER, AGENT
 * - OWNER: Full access
 * - MANAGER: Manage agents, view all conversations
 * - AGENT: View & reply only to assigned conversations
 */

const Permission = require('../models/Permission');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

// ─────────────────────────────────────────────────────────────────────────────
// ROLE HIERARCHY (Higher index = more permissions)
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_HIERARCHY = {
  viewer: 0,
  agent: 1,
  manager: 2,
  owner: 3
};

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

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 4: REQUIRE ROLE MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Require minimum role level (Stage 4)
 * @param {String|Array} allowedRoles - Single role or array of allowed roles
 * @returns {Function} Express middleware
 * 
 * Example:
 *   requireRole('owner')           - Only owners
 *   requireRole(['owner', 'manager']) - Owners or managers
 *   requireRole('manager')          - Managers and above (owners)
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
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

      // Create default permission if not exists
      if (!permission) {
        const user = await User.findById(userId).select('role').lean();
        const role = user?.role === 'owner' ? 'owner' : (user?.role === 'admin' ? 'manager' : 'agent');
        
        permission = {
          role,
          permissions: Permission.schema.statics.getDefaultPermissions(role),
          isActive: true
        };

        // Create in background
        Permission.create({
          workspace: workspaceId,
          user: userId,
          role,
          permissions: permission.permissions,
          isActive: true
        }).catch(err => console.error('[RBAC] Failed to create permission:', err.message));
      }

      // Check if user is active
      if (permission.isActive === false) {
        return res.status(403).json({
          success: false,
          message: 'User account is disabled',
          code: 'ACCOUNT_DISABLED'
        });
      }

      // Attach permissions to request
      req.permissions = permission;

      // Check role
      const userRole = permission.role;
      
      // Owner always passes
      if (userRole === 'owner') {
        return next();
      }

      // Check if user's role is in allowed list
      if (roles.includes(userRole)) {
        return next();
      }

      // Check hierarchy - if 'manager' is required, owner also passes
      const minRequiredLevel = Math.min(...roles.map(r => ROLE_HIERARCHY[r] || 0));
      const userLevel = ROLE_HIERARCHY[userRole] || 0;

      if (userLevel >= minRequiredLevel) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
        code: 'INSUFFICIENT_ROLE',
        requiredRoles: roles,
        currentRole: userRole
      });
    } catch (err) {
      console.error('[RBAC] Role check failed:', err.message);
      res.status(500).json({
        success: false,
        message: 'Role check failed',
        code: 'RBAC_ERROR'
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 4: CONVERSATION ACCESS CHECK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if agent can access a specific conversation
 * - Owners & Managers: Can access all conversations
 * - Agents: Can only access assigned conversations
 * 
 * @param {String} conversationIdParam - Request param name containing conversation ID
 */
function requireConversationAccess(conversationIdParam = 'conversationId') {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id;
      const workspaceId = req.user?.workspace;
      const conversationId = req.params[conversationIdParam] || req.body.conversationId;

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID required',
          code: 'MISSING_CONVERSATION_ID'
        });
      }

      // Get permission
      const permission = req.permissions || await Permission.findOne({
        workspace: workspaceId,
        user: userId
      }).lean();

      if (!permission) {
        return res.status(403).json({
          success: false,
          message: 'No permissions found',
          code: 'NO_PERMISSIONS'
        });
      }

      // Owners and managers can access all conversations
      if (permission.role === 'owner' || permission.role === 'manager' || 
          permission.permissions?.viewAllConversations) {
        return next();
      }

      // Agents can only access assigned conversations
      const conversation = await Conversation.findOne({
        _id: conversationId,
        workspace: workspaceId
      }).select('assignedTo').lean();

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND'
        });
      }

      // Check if conversation is assigned to this agent
      if (!conversation.assignedTo || 
          conversation.assignedTo.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this conversation',
          code: 'CONVERSATION_NOT_ASSIGNED',
          hint: 'Agents can only access conversations assigned to them'
        });
      }

      // Store conversation for downstream use
      req.conversation = conversation;
      next();
    } catch (err) {
      console.error('[RBAC] Conversation access check failed:', err.message);
      res.status(500).json({
        success: false,
        message: 'Access check failed',
        code: 'ACCESS_CHECK_ERROR'
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
 */
async function canViewResource(userId, workspaceId, resourceType, resourceId) {
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

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 4: HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get user's role in a workspace
 */
async function getUserRole(userId, workspaceId) {
  const permission = await Permission.findOne({
    workspace: workspaceId,
    user: userId
  }).select('role').lean();

  return permission?.role || 'viewer';
}

/**
 * Check if user can assign conversations
 */
async function canAssignConversations(userId, workspaceId) {
  const permission = await Permission.findOne({
    workspace: workspaceId,
    user: userId
  }).lean();

  if (!permission) return false;
  if (permission.role === 'owner' || permission.role === 'manager') return true;
  return permission.permissions?.assignConversations === true;
}

/**
 * Check if user can send messages in a conversation
 */
async function canSendMessage(userId, workspaceId, conversationId) {
  const permission = await Permission.findOne({
    workspace: workspaceId,
    user: userId
  }).lean();

  if (!permission || !permission.isActive) return false;
  
  // Owners and managers can send to any conversation
  if (permission.role === 'owner' || permission.role === 'manager') return true;

  // Agents can only send to assigned conversations
  if (permission.permissions?.sendMessages) {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspace: workspaceId
    }).select('assignedTo').lean();

    if (!conversation) return false;
    
    // Allow if assigned to this agent
    return conversation.assignedTo?.toString() === userId.toString();
  }

  return false;
}

module.exports = {
  requirePermission,
  requireRole,
  requireConversationAccess,
  applyAgentRestrictions,
  canViewResource,
  getUserRole,
  canAssignConversations,
  canSendMessage,
  ROLE_HIERARCHY
};
