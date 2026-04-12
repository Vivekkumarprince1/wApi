const { User, Workspace, Permission, AuditLog, Conversation, Team } = require('../../models');
const logger = require('../../utils/logger');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const emailService = require('../../services/infrastructure/emailService');

/**
 * TEAM MANAGEMENT CONTROLLER
 * Full Interakt-style team management:
 *  - Agent CRUD (invite, edit, role change, remove, availability)
 *  - Team CRUD (create, edit, delete, member hierarchy)
 *  - Permissions matrix
 *  - Auto-assign engine
 *  - Agent stats
 */

// ══════════════════════════════════════
// AGENT MEMBERS
// ══════════════════════════════════════

/**
 * List team members for workspace
 * GET /api/v1/team/members
 */
async function listTeamMembers(req, res, next) {
  try {
    const workspaceId = req.user.workspace;

    const members = await User.find({
      workspace: workspaceId,
      status: { $ne: 'removed' }
    })
      .select('_id name email phone role status joinedAt invitedAt team')
      .populate('team', '_id name')
      .lean();

    // Enrich with permission data and conversation counts
    const enrichedMembers = await Promise.all(members.map(async (member) => {
      const [permission, openCount] = await Promise.all([
        Permission.findOne({ workspace: workspaceId, user: member._id }).lean(),
        Conversation.countDocuments({
          workspace: workspaceId,
          assignedTo: member._id,
          status: { $in: ['open', 'pending'] }
        })
      ]);

      return {
        ...member,
        isOnline: permission?.isOnline || false,
        isAvailable: permission?.isAvailable || false,
        openConversations: openCount,
        maxConcurrentChats: permission?.maxConcurrentChats || 10,
        lastSeenAt: permission?.lastSeenAt || null,
        status: member.status === 'active' ? (permission?.isOnline ? 'active' : 'offline') : member.status
      };
    }));

    return res.status(200).json({
      success: true,
      members: enrichedMembers,
      total: enrichedMembers.length
    });
  } catch (error) {
    logger.error('[TeamController] listTeamMembers failed:', error);
    next(error);
  }
}

/**
 * Invite new team member (Interakt: Create Agent)
 * POST /api/v1/team/invite
 * Body: { email, name, role, phone }
 */
async function inviteTeamMember(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { email, role, name, phone } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'email and role required' });
    }

    const validRoles = ['admin', 'manager', 'agent', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Check if user already exists globally
    let user = await User.findOne({ email });

    if (user) {
      const isSameWorkspace = user.workspace && user.workspace.toString() === workspaceId.toString();

      if (isSameWorkspace) {
        if (user.status === 'removed') {
          // Re-invite removed user in same workspace
          user.status = 'invited';
          user.role = role;
          user.name = name || user.name;
          user.phone = phone || user.phone;
          user.removedAt = null;
          user.invitedAt = new Date();
          // Reset password and status for re-invited users
          user.passwordHash = passwordHash;
          user.accountStatus = 'SIGNUP_COMPLETED';
          user.emailVerified = true;
          await user.save();
        } else {
          return res.status(409).json({ error: 'User already in workspace' });
        }
      } else {
        // User exists in a DIFFERENT workspace
        return res.status(409).json({
          error: 'This email is already registered in another workspace. Multi-workspace membership is not supported yet.'
        });
      }
    } else {
      user = new User({
        name: name || email.split('@')[0],
        email,
        phone: phone || '',
        workspace: workspaceId,
        role,
        status: 'invited',
        invitedAt: new Date(),
        // Properly hashed for authentication
        passwordHash,
        // Agents/Team members skip onboarding flow
        accountStatus: 'SIGNUP_COMPLETED',
        emailVerified: true,
      });
      await user.save();
    }

    // Create default Permission record for the new agent
    // Seed permissions for user
    const existingPerm = await Permission.findOne({ workspace: workspaceId, user: user._id });
    const permissionRole = role === 'member' ? 'agent' : role;

    if (!existingPerm) {
      await Permission.create({
        workspace: workspaceId,
        user: user._id,
        role: permissionRole,
        permissions: Permission.getDefaultPermissions(permissionRole),
        isAvailable: true,
        isOnline: false,
        isActive: true
      });
    } else {
      // Reactivate and sync role/permissions for existing record
      existingPerm.role = permissionRole;
      existingPerm.permissions = Permission.getDefaultPermissions(permissionRole);
      existingPerm.isActive = true;
      existingPerm.isAvailable = true;
      await existingPerm.save();
    }

    // Audit log
    await AuditLog.create({
      workspace: workspaceId,
      action: 'team.member_invited',
      resource: { type: 'user', id: user._id },
      details: { email, role, name: user.name, status: 'success' }
    });

    // Send invitation email with login credentials
    try {
      const workspace = await Workspace.findById(workspaceId).select('name');
      await emailService.sendInvitationEmail({
        email: user.email,
        tempPassword,
        inviterName: req.user.name,
        workspaceName: workspace?.name || 'Your Team',
        role: user.role
      });
    } catch (emailError) {
      // We don't fail the whole request if email fails, but we log it
      logger.error('[TeamController] Failed to send invitation email:', emailError);
    }

    logger.info('[TeamController] Agent invited:', { workspaceId, email, role });

    return res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
      message: `Invitation sent to ${email}`,
    });
  } catch (error) {
    logger.error('[TeamController] inviteTeamMember failed:', error);
    next(error);
  }
}

/**
 * Update agent profile (Interakt: Edit Agent)
 * PUT /api/v1/team/members/:memberId
 * Body: { name, phone, role }
 */
async function updateMember(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { memberId } = req.params;
    const { name, phone, role } = req.body;

    const user = await User.findOne({ _id: memberId, workspace: workspaceId, status: { $ne: 'removed' } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'owner' && role && role !== 'owner') {
      return res.status(403).json({ error: 'Cannot change owner role' });
    }

    const changes = {};
    if (name !== undefined && name.trim()) { user.name = name.trim(); changes.name = name.trim(); }
    if (phone !== undefined) { user.phone = phone; changes.phone = phone; }
    if (role !== undefined && role !== user.role) {
      const validRoles = ['owner', 'admin', 'manager', 'agent', 'member', 'viewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      const oldRole = user.role;
      user.role = role;
      changes.oldRole = oldRole;
      changes.newRole = role;

      // Sync Permission model role and reset permissions to defaults for new role
      const permRole = role === 'member' ? 'agent' : role;
      const perm = await Permission.findOne({ workspace: workspaceId, user: memberId });
      if (perm) {
        perm.role = permRole;
        perm.permissions = Permission.getDefaultPermissions(permRole);
        perm.isActive = true; // Ensure active on role change
        await perm.save();
      } else {
        await Permission.create({
          workspace: workspaceId,
          user: memberId,
          role: permRole,
          permissions: Permission.getDefaultPermissions(permRole),
          isAvailable: true,
          isActive: true
        });
      }
    }

    await user.save();

    await AuditLog.create({
      workspace: workspaceId,
      action: 'team.member_updated',
      resource: { type: 'user', id: memberId },
      details: { ...changes, email: user.email, status: 'success' }
    });

    logger.info('[TeamController] Agent updated:', { workspaceId, memberId, changes });

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    logger.error('[TeamController] updateMember failed:', error);
    next(error);
  }
}

/**
 * Update team member role
 * PUT /api/v1/team/members/:memberId/role
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

    const validRoles = ['owner', 'admin', 'manager', 'agent', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findOne({ _id: memberId, workspace: workspaceId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'owner') {
      return res.status(403).json({ error: 'Cannot change owner role' });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    // Sync Permission model and reset permissions to defaults for new role
    const permRole = role === 'member' ? 'agent' : role;
    const perm = await Permission.findOne({ workspace: workspaceId, user: memberId });
    if (perm) {
      perm.role = permRole;
      perm.permissions = Permission.getDefaultPermissions(permRole);
      perm.isActive = true; // Ensure active
      await perm.save();
    } else {
      await Permission.create({
        workspace: workspaceId,
        user: memberId,
        role: permRole,
        permissions: Permission.getDefaultPermissions(permRole),
        isAvailable: true,
        isActive: true
      });
    }

    await AuditLog.create({
      workspace: workspaceId,
      action: 'team.permissions_changed',
      resource: { type: 'user', id: memberId },
      details: { oldRole, newRole: role, email: user.email, status: 'success' }
    });

    logger.info('[TeamController] Member role updated:', { workspaceId, memberId, oldRole, newRole: role });

    return res.status(200).json({
      success: true,
      user: { _id: user._id, email: user.email, role: user.role },
    });
  } catch (error) {
    logger.error('[TeamController] updateMemberRole failed:', error);
    next(error);
  }
}

/**
 * Remove team member (Interakt: Delete Agent)
 * DELETE /api/v1/team/members/:memberId
 */
async function removeTeamMember(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { memberId } = req.params;

    const user = await User.findOne({ _id: memberId, workspace: workspaceId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'owner') {
      return res.status(403).json({ error: 'Cannot remove workspace owner' });
    }

    // Soft delete
    user.status = 'removed';
    user.removedAt = new Date();
    await user.save();

    // Deactivate permission
    await Permission.findOneAndUpdate(
      { workspace: workspaceId, user: memberId },
      { $set: { isActive: false, isOnline: false, isAvailable: false } }
    );

    // Remove from any teams
    await Team.updateMany(
      { workspaceId, 'members.user': memberId },
      { $pull: { members: { user: memberId } } }
    );

    // Unassign open conversations
    await Conversation.updateMany(
      { workspace: workspaceId, assignedTo: memberId, status: { $in: ['open', 'pending'] } },
      { $unset: { assignedTo: '' } }
    );

    await AuditLog.create({
      workspace: workspaceId,
      action: 'team.member_removed',
      resource: { type: 'user', id: memberId },
      details: { email: user.email, role: user.role, status: 'success' }
    });

    logger.info('[TeamController] Agent removed:', { workspaceId, memberId, email: user.email });

    return res.status(200).json({ success: true, message: 'Agent removed successfully' });
  } catch (error) {
    logger.error('[TeamController] removeTeamMember failed:', error);
    next(error);
  }
}

/**
 * Toggle agent availability (self-service)
 * PUT /api/v1/team/availability
 * Body: { isAvailable }
 */
async function toggleAvailability(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const userId = req.user._id;
    const { isAvailable } = req.body;

    if (isAvailable === undefined) {
      return res.status(400).json({ error: 'isAvailable required' });
    }

    const permission = await Permission.findOneAndUpdate(
      { workspace: workspaceId, user: userId },
      { $set: { isAvailable: !!isAvailable } },
      { new: true, upsert: true }
    );

    logger.info('[TeamController] Availability toggled:', { userId, isAvailable });

    return res.status(200).json({
      success: true,
      isAvailable: permission.isAvailable,
    });
  } catch (error) {
    logger.error('[TeamController] toggleAvailability failed:', error);
    next(error);
  }
}

/**
 * Update agent settings (admin)
 * PUT /api/v1/team/members/:memberId/settings
 * Body: { isAvailable, maxConcurrentChats, assignedTags, assignedPhones }
 */
async function updateMemberSettings(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { memberId } = req.params;
    const { isAvailable, maxConcurrentChats, assignedTags, assignedPhones } = req.body;

    const updateFields = {};
    if (isAvailable !== undefined) updateFields.isAvailable = isAvailable;
    if (maxConcurrentChats !== undefined) updateFields.maxConcurrentChats = maxConcurrentChats;
    if (assignedTags !== undefined) updateFields.assignedTags = assignedTags;
    if (assignedPhones !== undefined) updateFields.assignedPhones = assignedPhones;

    const permission = await Permission.findOneAndUpdate(
      { workspace: workspaceId, user: memberId },
      { $set: updateFields },
      { new: true, upsert: true }
    );

    await AuditLog.create({
      workspace: workspaceId,
      action: 'team.member_settings_updated',
      resource: { type: 'user', id: memberId },
      details: { ...updateFields, status: 'success' }
    });

    return res.status(200).json({
      success: true,
      settings: {
        isAvailable: permission.isAvailable,
        maxConcurrentChats: permission.maxConcurrentChats,
        assignedTags: permission.assignedTags,
        assignedPhones: permission.assignedPhones,
      },
    });
  } catch (error) {
    logger.error('[TeamController] updateMemberSettings failed:', error);
    next(error);
  }
}

/**
 * Get agent stats (chat assignments, availability)
 * GET /api/v1/team/members/:memberId/stats
 */
async function getMemberStats(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { memberId } = req.params;

    const [user, permission, openCount, resolvedToday, totalAssigned] = await Promise.all([
      User.findOne({ _id: memberId, workspace: workspaceId }).select('name email role status').lean(),
      Permission.findOne({ workspace: workspaceId, user: memberId }).lean(),
      Conversation.countDocuments({ workspace: workspaceId, assignedTo: memberId, status: { $in: ['open', 'pending'] } }),
      Conversation.countDocuments({
        workspace: workspaceId, assignedTo: memberId, status: 'resolved',
        updatedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      Conversation.countDocuments({ workspace: workspaceId, assignedTo: memberId })
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      stats: {
        user,
        isOnline: permission?.isOnline || false,
        isAvailable: permission?.isAvailable || false,
        maxConcurrentChats: permission?.maxConcurrentChats || 10,
        lastSeenAt: permission?.lastSeenAt || null,
        openConversations: openCount,
        resolvedToday,
        totalAssigned,
        assignedTags: permission?.assignedTags || [],
        assignedPhones: permission?.assignedPhones || [],
      }
    });
  } catch (error) {
    logger.error('[TeamController] getMemberStats failed:', error);
    next(error);
  }
}

/**
 * Get permissions matrix (Interakt: Roles & Permissions)
 * GET /api/v1/team/permissions
 */
async function getPermissionsMatrix(req, res, next) {
  try {
    const roles = {
      owner: {
        name: 'Owner',
        description: 'Full access to everything',
        permissions: [
          'admin.manage', 'messaging.send', 'messaging.campaigns',
          'templates.manage', 'templates.submit',
          'billing.manage', 'billing.view',
          'team.manage',
          'analytics.view', 'analytics.export',
          'contacts.manage', 'contacts.import', 'contacts.export', 'contacts.delete',
          'conversations.view_all', 'conversations.assign', 'conversations.resolve',
          'deals.manage', 'deals.delete',
          'integrations.manage', 'webhooks.manage',
          'audit_logs.view',
        ],
      },
      admin: {
        name: 'Admin',
        description: 'Full access except billing transfer',
        permissions: [
          'admin.manage', 'messaging.send', 'messaging.campaigns',
          'templates.manage', 'templates.submit',
          'billing.view',
          'team.manage',
          'analytics.view', 'analytics.export',
          'contacts.manage', 'contacts.import', 'contacts.export', 'contacts.delete',
          'conversations.view_all', 'conversations.assign', 'conversations.resolve',
          'deals.manage', 'deals.delete',
          'integrations.manage', 'webhooks.manage',
          'audit_logs.view',
        ],
      },
      manager: {
        name: 'Manager',
        description: 'Manages team, templates, and campaigns',
        permissions: [
          'messaging.send', 'messaging.campaigns',
          'templates.manage',
          'team.manage',
          'analytics.view',
          'contacts.manage', 'contacts.import', 'contacts.export',
          'conversations.view_all', 'conversations.assign', 'conversations.resolve',
          'deals.manage',
        ],
      },
      agent: {
        name: 'Agent',
        description: 'Handles conversations and contacts',
        permissions: [
          'messaging.send',
          'templates.view',
          'contacts.manage',
          'conversations.view_own', 'conversations.resolve',
          'deals.view', 'deals.create',
          'analytics.view',
        ],
      },
      viewer: {
        name: 'Viewer',
        description: 'Read-only access',
        permissions: [
          'conversations.view_own',
          'contacts.view',
          'analytics.view',
          'templates.view',
          'deals.view',
        ],
      },
    };

    return res.status(200).json({ success: true, roles });
  } catch (error) {
    logger.error('[TeamController] getPermissionsMatrix failed:', error);
    next(error);
  }
}

// ══════════════════════════════════════
// TEAMS (Groups)
// ══════════════════════════════════════

/**
 * List all teams for workspace
 * GET /api/v1/team/teams
 */
async function listTeams(req, res, next) {
  try {
    const workspaceId = req.user.workspace;

    const teams = await Team.find({ workspaceId, isActive: true })
      .populate('members.user', '_id name email role status')
      .populate('createdBy', '_id name email')
      .sort('-createdAt')
      .lean();

    return res.status(200).json({ success: true, teams, total: teams.length });
  } catch (error) {
    logger.error('[TeamController] listTeams failed:', error);
    next(error);
  }
}

/**
 * Create a new team
 * POST /api/v1/team/teams
 * Body: { name, description, members: [{ user, role }], visibility, autoAssign }
 */
async function createTeam(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { name, description, members, visibility, autoAssign } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Team name is required' });
    }

    // Check for duplicate name
    const existing = await Team.findOne({ workspaceId, name: name.trim(), isActive: true });
    if (existing) {
      return res.status(409).json({ message: 'A team with this name already exists' });
    }

    // Validate members belong to workspace
    if (members && members.length > 0) {
      const userIds = members.map(m => m.user);
      const validUsers = await User.countDocuments({
        _id: { $in: userIds },
        workspace: workspaceId,
        status: { $ne: 'removed' }
      });
      if (validUsers !== userIds.length) {
        return res.status(400).json({ message: 'Some members do not belong to this workspace' });
      }

      // Ensure at least one lead
      const hasLead = members.some(m => m.role === 'lead');
      if (!hasLead && members.length > 0) {
        members[0].role = 'lead';
      }
    }

    const team = new Team({
      workspaceId,
      name: name.trim(),
      description: description?.trim(),
      members: members || [],
      visibility: visibility || 'team_only',
      autoAssign: autoAssign || { enabled: false, strategy: 'round_robin' },
      createdBy: req.user._id
    });

    await team.save();

    // Update user team references
    if (members && members.length > 0) {
      await User.updateMany(
        { _id: { $in: members.map(m => m.user) } },
        { $set: { team: team._id } }
      );
    }

    await team.populate('members.user', '_id name email role status');

    await AuditLog.create({
      workspace: workspaceId,
      action: 'team.created',
      resource: { type: 'team', id: team._id },
      details: { name: team.name, memberCount: team.members.length, status: 'success' }
    });

    logger.info('[TeamController] Team created:', { workspaceId, teamId: team._id, name: team.name });

    return res.status(201).json({ success: true, team });
  } catch (error) {
    logger.error('[TeamController] createTeam failed:', error);
    next(error);
  }
}

/**
 * Update a team
 * PUT /api/v1/team/teams/:teamId
 */
async function updateTeam(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { teamId } = req.params;
    const { name, description, members, visibility, autoAssign } = req.body;

    const team = await Team.findOne({ _id: teamId, workspaceId });
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (name !== undefined) {
      const dup = await Team.findOne({ workspaceId, name: name.trim(), _id: { $ne: teamId }, isActive: true });
      if (dup) return res.status(409).json({ message: 'A team with this name already exists' });
      team.name = name.trim();
    }

    if (description !== undefined) team.description = description?.trim();
    if (visibility !== undefined) team.visibility = visibility;
    if (autoAssign !== undefined) {
      team.autoAssign = { ...team.autoAssign.toObject?.() || team.autoAssign, ...autoAssign };
    }

    if (members !== undefined) {
      const userIds = members.map(m => m.user);
      const validUsers = await User.countDocuments({
        _id: { $in: userIds }, workspace: workspaceId, status: { $ne: 'removed' }
      });
      if (validUsers !== userIds.length) {
        return res.status(400).json({ message: 'Some members do not belong to this workspace' });
      }

      // Clear old member team references
      const oldMemberIds = team.members.map(m => m.user);
      await User.updateMany(
        { _id: { $in: oldMemberIds }, team: team._id },
        { $unset: { team: '' } }
      );

      team.members = members;

      // Set new member team references
      await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { team: team._id } }
      );
    }

    await team.save();
    await team.populate('members.user', '_id name email role status');

    await AuditLog.create({
      workspace: workspaceId,
      action: 'team.updated',
      resource: { type: 'team', id: team._id },
      details: { name: team.name, status: 'success' }
    });

    return res.status(200).json({ success: true, team });
  } catch (error) {
    logger.error('[TeamController] updateTeam failed:', error);
    next(error);
  }
}

/**
 * Delete a team
 * DELETE /api/v1/team/teams/:teamId
 */
async function deleteTeam(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { teamId } = req.params;

    const team = await Team.findOne({ _id: teamId, workspaceId });
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Clear team references from users
    const memberIds = team.members.map(m => m.user);
    await User.updateMany(
      { _id: { $in: memberIds }, team: team._id },
      { $unset: { team: '' } }
    );

    // Soft delete
    team.isActive = false;
    await team.save();

    await AuditLog.create({
      workspace: workspaceId,
      action: 'team.deleted',
      resource: { type: 'team', id: team._id },
      details: { name: team.name, status: 'success' }
    });

    logger.info('[TeamController] Team deleted:', { workspaceId, teamId, name: team.name });

    return res.status(200).json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    logger.error('[TeamController] deleteTeam failed:', error);
    next(error);
  }
}

// ══════════════════════════════════════
// AUTO-ASSIGN ENGINE
// ══════════════════════════════════════

/**
 * Auto-assign a conversation to the best available agent
 * Called internally or via POST /api/v1/team/auto-assign
 * Body: { conversationId, teamId? }
 */
async function autoAssignConversation(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { conversationId, teamId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId required' });
    }

    const conversation = await Conversation.findOne({ _id: conversationId, workspace: workspaceId });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Determine team and strategy
    let team = null;
    let strategy = 'round_robin';

    if (teamId) {
      team = await Team.findOne({ _id: teamId, workspaceId, isActive: true });
    }

    if (team && team.autoAssign?.enabled) {
      strategy = team.autoAssign.strategy || 'round_robin';
    }

    // Get available agents
    const agentFilter = {
      workspace: workspaceId,
      isAvailable: true,
      isActive: true,
    };

    if (team) {
      const memberIds = team.members.map(m => m.user);
      agentFilter.user = { $in: memberIds };
    }

    const availableAgents = await Permission.find(agentFilter)
      .populate('user', '_id name email team')
      .select('user maxConcurrentChats')
      .lean();

    if (availableAgents.length === 0) {
      return res.status(200).json({ success: false, message: 'No available agents', assignedTo: null });
    }

    // Get current chat counts for each agent
    const agentCounts = await Promise.all(
      availableAgents.map(async (agent) => {
        const count = await Conversation.countDocuments({
          workspace: workspaceId,
          assignedTo: agent.user._id,
          status: { $in: ['open', 'pending'] }
        });
        return { ...agent, currentChats: count };
      })
    );

    // Filter out agents at max capacity
    const eligibleAgents = agentCounts.filter(a => a.currentChats < a.maxConcurrentChats);
    if (eligibleAgents.length === 0) {
      return res.status(200).json({ success: false, message: 'All agents at max capacity', assignedTo: null });
    }

    let selectedAgent;
    switch (strategy) {
      case 'least_busy':
        selectedAgent = eligibleAgents.sort((a, b) => a.currentChats - b.currentChats)[0];
        break;
      case 'random':
        selectedAgent = eligibleAgents[Math.floor(Math.random() * eligibleAgents.length)];
        break;
      case 'round_robin':
      default:
        // Simple round robin: pick the agent with the fewest total assignments
        selectedAgent = eligibleAgents.sort((a, b) => a.currentChats - b.currentChats)[0];
        break;
    }

    // Assign the conversation
    conversation.assignedTo = selectedAgent.user;
    conversation.team = selectedAgent.user?.team || team?._id || conversation.team || null;
    await conversation.save();

    const assignedUser = await User.findById(selectedAgent.user._id).select('name email').lean();

    logger.info('[TeamController] Auto-assigned conversation:', {
      conversationId, assignedTo: selectedAgent.user._id, strategy
    });

    return res.status(200).json({
      success: true,
      assignedTo: {
        _id: selectedAgent.user._id,
        name: assignedUser?.name,
        email: assignedUser?.email,
      },
      strategy,
    });
  } catch (error) {
    logger.error('[TeamController] autoAssignConversation failed:', error);
    next(error);
  }
}

module.exports = {
  // Agent members
  listTeamMembers,
  inviteTeamMember,
  updateMember,
  updateMemberRole,
  removeTeamMember,
  toggleAvailability,
  updateMemberSettings,
  getMemberStats,
  getPermissionsMatrix,
  // Teams (groups)
  listTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  // Auto-assign
  autoAssignConversation,
};
