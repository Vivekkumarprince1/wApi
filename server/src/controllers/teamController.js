const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Permission = require('../models/Permission');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');

/**
 * TEAM MANAGEMENT CONTROLLER
 * Week 2: RBAC team management endpoints
 */

/**
 * List team members for workspace
 * GET /api/v1/admin/team/members
 */
async function listTeamMembers(req, res, next) {
  try {
    const workspaceId = req.user.workspace;

    const members = await User.find({ workspace: workspaceId })
      .select('_id name email role status joinedAt')
      .lean();

    return res.status(200).json({
      success: true,
      members,
    });
  } catch (error) {
    logger.error('[TeamController] listTeamMembers failed:', error);
    next(error);
  }
}

/**
 * Invite new team member
 * POST /api/v1/admin/team/invite
 * Body: { email, role }
 */
async function inviteTeamMember(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'email and role required' });
    }

    // Check if user already exists
    let user = await User.findOne({ email, workspace: workspaceId });

    if (user) {
      return res.status(409).json({ error: 'User already in workspace' });
    }

    // Create user with invited status
    user = new User({
      email,
      workspace: workspaceId,
      role,
      status: 'invited', // Will become 'active' on first login
      invitedAt: new Date(),
    });

    await user.save();

    // Create audit log
    await AuditLog.create({
      workspaceId,
      entityType: 'user',
      entityId: user._id,
      action: 'invite',
      details: {
        email,
        role,
      },
      status: 'success',
    });

    // TODO: Send invitation email with link to accept

    logger.info('[TeamController] Team member invited:', {
      workspaceId,
      email,
      role,
    });

    return res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    logger.error('[TeamController] inviteTeamMember failed:', error);
    next(error);
  }
}

/**
 * Update team member role
 * PUT /api/v1/admin/team/members/:memberId/role
 * Body: { role }
 */
async function updateMemberRole(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { memberId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'role required' });
    }

    const validRoles = ['owner', 'manager', 'agent', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findOne({
      _id: memberId,
      workspace: workspaceId,
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    // Create audit log
    await AuditLog.create({
      workspaceId,
      entityType: 'user',
      entityId: memberId,
      action: 'role_updated',
      details: {
        oldRole,
        newRole: role,
        email: user.email,
      },
      status: 'success',
    });

    logger.info('[TeamController] Member role updated:', {
      workspaceId,
      memberId,
      oldRole,
      newRole: role,
    });

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('[TeamController] updateMemberRole failed:', error);
    next(error);
  }
}

/**
 * Remove team member from workspace
 * DELETE /api/v1/admin/team/members/:memberId
 */
async function removeTeamMember(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { memberId } = req.params;

    // Prevent removing owner
    const user = await User.findOne({
      _id: memberId,
      workspace: workspaceId,
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'owner') {
      return res.status(403).json({ error: 'Cannot remove workspace owner' });
    }

    // Remove user from workspace (soft delete)
    user.status = 'removed';
    user.removedAt = new Date();
    await user.save();

    // Create audit log
    await AuditLog.create({
      workspaceId,
      entityType: 'user',
      entityId: memberId,
      action: 'remove',
      details: {
        email: user.email,
        role: user.role,
      },
      status: 'success',
    });

    logger.info('[TeamController] Member removed:', {
      workspaceId,
      memberId,
      email: user.email,
    });

    return res.status(200).json({
      success: true,
      message: 'Member removed',
    });
  } catch (error) {
    logger.error('[TeamController] removeTeamMember failed:', error);
    next(error);
  }
}

/**
 * Get permissions matrix for all roles
 * GET /api/v1/admin/team/permissions
 */
async function getPermissionsMatrix(req, res, next) {
  try {
    const roles = {
      owner: {
        name: 'Owner',
        permissions: [
          'admin.manage',
          'messaging.send',
          'templates.manage',
          'billing.manage',
          'team.manage',
          'analytics.export',
          'contacts.manage',
        ],
      },
      manager: {
        name: 'Manager',
        permissions: [
          'messaging.send',
          'templates.manage',
          'team.manage',
          'analytics.view',
          'billing.view',
          'contacts.manage',
        ],
      },
      agent: {
        name: 'Agent',
        permissions: [
          'messaging.send',
          'conversations.view',
          'contacts.manage',
          'templates.view',
        ],
      },
      viewer: {
        name: 'Viewer',
        permissions: ['conversations.view', 'contacts.view', 'analytics.view'],
      },
    };

    return res.status(200).json({
      success: true,
      roles,
    });
  } catch (error) {
    logger.error('[TeamController] getPermissionsMatrix failed:', error);
    next(error);
  }
}

module.exports = {
  listTeamMembers,
  inviteTeamMember,
  updateMemberRole,
  removeTeamMember,
  getPermissionsMatrix,
};
