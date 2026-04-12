/**
 * Inbox Controller - Stage 4 + Hardening
 * Handles Shared Inbox operations: Assignment, Status Changes, Agent Messaging
 * 
 * Following Interakt's architecture for:
 * - Conversation assignment (assign/unassign/reassign)
 * - Status management (close/reopen/snooze)
 * - Agent messaging with permission validation
 * 
 * Stage 4 Hardening additions:
 * - Soft lock / typing indicators
 * - SLA monitoring endpoints
 * - Rate limit status
 */

const mongoose = require('mongoose');
const { Conversation, Message, Contact, User, Permission, Team } = require('../../models');
const { getIO } = require('../../utils/socket');
const { uploadBufferToCloudinary } = require('../../utils/cloudinary');
const inboxSocketService = require('../../services/messaging/inboxSocketService');
const { automationEvents } = require('../../services/automation/automationEventEmitter');

// Hardening services
const softLockService = require('../../services/infrastructure/softLockService');
const slaService = require('../../services/infrastructure/slaService');
const agentRateLimitService = require('../../services/infrastructure/agentRateLimitService');

async function ensurePermissions(req) {
  if (req.permissions) return req.permissions;

  const userId = req.user?._id;
  const workspaceId = req.user?.workspace;

  if (!userId || !workspaceId) return null;

  let permission = await Permission.findOne({
    workspace: workspaceId,
    user: userId
  }); // Removed .lean() to allow .save()

  // Self-healing & Role Sync: 
  // 1. Ensure Permission role matches the actual User role
  const trueRole = req.user.role || permission?.role || 'viewer';
  let needsSave = false;

  if (permission && permission.role !== trueRole) {
    console.log(`[INBOX] Syncing role for user ${userId}: ${permission.role} -> ${trueRole}`);
    permission.role = trueRole;
    permission.permissions = Permission.getDefaultPermissions(trueRole);
    needsSave = true;
  }

  // 1.5 Self-healing: Ensure isActive is true if the session is valid
  if (permission && !permission.isActive) {
    console.log(`[INBOX] Self-healing: Reactivating permission for user ${userId}`);
    permission.isActive = true;
    needsSave = true;
  }

  // 2. Repair hollow or misconfigured permissions
  const needsRepair = permission && !needsSave && (
    !permission.permissions || 
    Object.keys(permission.permissions || {}).length < 5 ||
    (['owner', 'admin', 'manager'].includes(permission.role) && !permission.permissions.viewAllConversations)
  );

  if (needsRepair) {
    console.log(`[INBOX] Repairing permissions for role: ${permission.role}`);
    permission.permissions = Permission.getDefaultPermissions(permission.role);
    needsSave = true;
  }

  if (needsSave) {
    await permission.save().catch(err => console.error('[INBOX] Failed to sync/repair permissions:', err.message));
  }

  if (!permission) {
    // Stage 4 Hardening: If User record doesn't exist for this ID, the session is stale.
    // Return 401 to force frontend to refresh/logout.
    const user = await User.findById(userId).select('role').lean();
    if (!user) {
      console.warn(`[INBOX] Stale session detected for user ID: ${userId}. Forcing re-auth.`);
      return null; // Controller handles this as 401/403
    }

    const role = user.role || 'viewer';
    const defaultPermissions = Permission.getDefaultPermissions(role);

    permission = await Permission.create({
      workspace: workspaceId,
      user: userId,
      role,
      permissions: defaultPermissions,
      isActive: true
    }).catch(err => {
      console.error('[INBOX] Failed to seed permissions:', err.message);
      return { role, permissions: defaultPermissions };
    });
  }

  req.permissions = permission;
  return permission;
}

async function getUserTeamIds(workspaceId, userId) {
  const directTeamId = await User.findById(userId).select('team').lean().then(user => user?.team?.toString?.() || null);
  if (directTeamId) {
    return [directTeamId];
  }

  const teams = await Team.find({ workspaceId, 'members.user': userId, isActive: true }).select('_id').lean();
  return teams.map(team => team._id.toString());
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSIGNMENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assign conversation to an agent
 * POST /api/inbox/:conversationId/assign
 * 
 * Owners/Admins can assign globally; managers are scoped to their team.
 */
exports.assignConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { agentId } = req.body;
    const workspaceId = req.user.workspace;
    const assignedById = req.user._id;

    // 1. Permission Check
    const permission = await ensurePermissions(req);
    const isGlobalAssigner = ['owner', 'admin'].includes(permission?.role);
    const actorTeamId = (await getUserTeamIds(workspaceId, assignedById))[0] || null;
    
    // 2. Validate agent exists and belongs to workspace
    const agent = await User.findOne({
      _id: agentId,
      workspace: workspaceId
    }).select('_id name email team');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found in this workspace',
        code: 'AGENT_NOT_FOUND'
      });
    }

    // 3. Team Boundary Validation for team-scoped assigners
    if (!isGlobalAssigner) {
      if (!actorTeamId) {
        return res.status(403).json({
          success: false,
          message: 'You must belong to a team to assign conversations',
          code: 'TEAM_REQUIRED'
        });
      }

      const targetTeamId = (await getUserTeamIds(workspaceId, agentId))[0] || agent.team?.toString() || null;
      const conversation = await Conversation.findOne({
        _id: conversationId,
        workspace: workspaceId
      }).select('team assignedTo status');

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND'
        });
      }

      const conversationTeamId = conversation.team?.toString() || null;
      const scopedTeamId = conversationTeamId || actorTeamId;

      if (scopedTeamId !== actorTeamId || targetTeamId !== actorTeamId) {
        return res.status(403).json({
          success: false,
          message: 'You can only assign conversations to members of your own team',
          code: 'TEAM_RESTRICTION'
        });
      }
    }

    // 4. Check agent has permission to receive assignments (target agent)
    const agentPermission = await Permission.findOne({
      workspace: workspaceId,
      user: agentId,
      isActive: true
    });

    if (!agentPermission) {
      return res.status(400).json({
        success: false,
        message: 'Agent does not have active permissions',
        code: 'AGENT_INACTIVE'
      });
    }

    const openConversationCount = await Conversation.countDocuments({
      workspace: workspaceId,
      assignedTo: agentId,
      status: { $in: ['open', 'pending'] }
    });

    if (agentPermission.isAvailable === false || openConversationCount >= (agentPermission.maxConcurrentChats || 10)) {
      return res.status(409).json({
        success: false,
        message: 'Agent is unavailable or at capacity',
        code: 'AGENT_NOT_ACCEPTING'
      });
    }

    // Get and update conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspace: workspaceId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    const previousAssignee = conversation.assignedTo;

    // Use the model method for assignment
    conversation.assignTo(agentId, assignedById);
    
    // Update team reference to match the active team scope
    if (isGlobalAssigner) {
      if (agent.team) {
        conversation.team = agent.team;
      }
    } else if (actorTeamId) {
      conversation.team = actorTeamId;
    }

    // Reopen if closed
    if (conversation.status === 'closed') {
      conversation.updateStatus('open', assignedById);
    }

    await conversation.save();

    // Populate for response
    await conversation.populate([
      { path: 'contact', select: 'name phone email' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'assignedBy', select: 'name email' }
    ]);

    // Emit socket event for real-time update
    const io = getIO();
    if (io) {
      // Notify workspace about assignment
      io.to(`workspace:${workspaceId}`).emit('conversation:assigned', {
        conversationId: conversation._id,
        assignedTo: {
          _id: agent._id,
          name: agent.name,
          email: agent.email
        },
        assignedBy: {
          _id: req.user._id,
          name: req.user.name
        },
        previousAssignee: previousAssignee?.toString() || null
      });

      // Notify the specific agent
      io.to(`user:${agentId}`).emit('inbox:new-assignment', {
        conversation: conversation.toObject()
      });

      // Notify previous assignee if different
      if (previousAssignee && previousAssignee.toString() !== agentId.toString()) {
        io.to(`user:${previousAssignee}`).emit('inbox:unassigned', {
          conversationId: conversation._id
        });
      }
    }

    automationEvents.conversationAssigned({
      workspaceId,
      conversationId: conversation._id,
      contactId: conversation.contact?._id || conversation.contact,
      metadata: {
        assignedTo: {
          _id: agent._id,
          name: agent.name,
          email: agent.email
        },
        assignedBy: {
          _id: req.user._id,
          name: req.user.name
        },
        previousAssignee: previousAssignee?.toString() || null,
        teamId: conversation.team?._id?.toString?.() || conversation.team?.toString?.() || null
      }
    });

    console.log(`[INBOX] Conversation ${conversationId} assigned to ${agent.name} by ${req.user.name}`);

    res.json({
      success: true,
      message: `Conversation assigned to ${agent.name}`,
      data: conversation
    });

  } catch (err) {
    console.error('[INBOX] Assignment error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to assign conversation',
      code: 'ASSIGNMENT_ERROR'
    });
  }
};

/**
 * Unassign conversation
 * POST /api/inbox/:conversationId/unassign
 */
exports.unassignConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const workspaceId = req.user.workspace;
    const unassignedById = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspace: workspaceId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    const previousAssignee = conversation.assignedTo;

    if (!previousAssignee) {
      return res.status(400).json({
        success: false,
        message: 'Conversation is not assigned',
        code: 'NOT_ASSIGNED'
      });
    }

    // Use model method
    conversation.unassign(unassignedById);
    await conversation.save();

    await conversation.populate('contact', 'name phone email');

    // Socket notification
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('conversation:unassigned', {
        conversationId: conversation._id,
        unassignedBy: {
          _id: req.user._id,
          name: req.user.name
        }
      });

      // Notify the previous assignee
      io.to(`user:${previousAssignee}`).emit('inbox:unassigned', {
        conversationId: conversation._id
      });
    }

    automationEvents.conversationUnassigned({
      workspaceId,
      conversationId: conversation._id,
      contactId: conversation.contact?._id || conversation.contact,
      metadata: {
        unassignedBy: {
          _id: req.user._id,
          name: req.user.name
        },
        previousAssignee: previousAssignee?.toString() || null,
        teamId: conversation.team?._id?.toString?.() || conversation.team?.toString?.() || null
      }
    });

    console.log(`[INBOX] Conversation ${conversationId} unassigned by ${req.user.name}`);

    res.json({
      success: true,
      message: 'Conversation unassigned',
      data: conversation
    });

  } catch (err) {
    console.error('[INBOX] Unassignment error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to unassign conversation',
      code: 'UNASSIGNMENT_ERROR'
    });
  }
};

/**
 * Self-assign conversation (Agent picks from unassigned pool)
 * POST /api/inbox/:conversationId/claim
 */
exports.claimConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;

    const permission = await ensurePermissions(req);
    if (!permission) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or user not found. Please login again.',
        code: 'STALE_SESSION'
      });
    }

    const ownPermission = await Permission.findOne({
      workspace: workspaceId,
      user: agentId,
      isActive: true
    }).lean();

    if (!ownPermission) {
      return res.status(400).json({
        success: false,
        message: 'Agent does not have active permissions',
        code: 'AGENT_INACTIVE'
      });
    }

    const openConversationCount = await Conversation.countDocuments({
      workspace: workspaceId,
      assignedTo: agentId,
      status: { $in: ['open', 'pending'] }
    });

    if (ownPermission.isAvailable === false || openConversationCount >= (ownPermission.maxConcurrentChats || 10)) {
      return res.status(409).json({
        success: false,
        message: 'Agent is unavailable or at capacity',
        code: 'AGENT_NOT_ACCEPTING'
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspace: workspaceId,
      assignedTo: null // Can only claim unassigned
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or already assigned',
        code: 'CONVERSATION_NOT_AVAILABLE'
      });
    }

    // Assign to self
    conversation.assignTo(agentId, agentId);

    if (conversation.status === 'closed') {
      conversation.updateStatus('open', agentId);
    }

    await conversation.save();

    await conversation.populate([
      { path: 'contact', select: 'name phone email' },
      { path: 'assignedTo', select: 'name email' }
    ]);

    // Socket notification
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('conversation:claimed', {
        conversationId: conversation._id,
        claimedBy: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email
        }
      });
    }

    automationEvents.conversationAssigned({
      workspaceId,
      conversationId: conversation._id,
      contactId: conversation.contact?._id || conversation.contact,
      metadata: {
        assignedTo: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email
        },
        assignedBy: {
          _id: req.user._id,
          name: req.user.name
        },
        previousAssignee: null,
        claimed: true,
        teamId: conversation.team?._id?.toString?.() || conversation.team?.toString?.() || null
      }
    });

    console.log(`[INBOX] Conversation ${conversationId} claimed by ${req.user.name}`);

    res.json({
      success: true,
      message: 'Conversation claimed successfully',
      data: conversation
    });

  } catch (err) {
    console.error('[INBOX] Claim error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to claim conversation',
      code: 'CLAIM_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// STATUS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Close conversation
 * POST /api/inbox/:conversationId/close
 */
exports.closeConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { resolution } = req.body; // Optional resolution note
    const workspaceId = req.user.workspace;
    const closedById = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspace: workspaceId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    // Check if agent can close this conversation
    const permission = await ensurePermissions(req);
    if (!permission) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or user not found. Please login again.',
        code: 'STALE_SESSION'
      });
    }
    if (permission.role === 'agent' &&
      conversation.assignedTo?.toString() !== closedById.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Agents can only close their assigned conversations',
        code: 'NOT_ASSIGNED_TO_AGENT'
      });
    }

    conversation.updateStatus('closed', closedById);

    if (resolution) {
      conversation.notes = (conversation.notes || '') + `\n[Closed] ${resolution}`;
    }

    await conversation.save();

    await conversation.populate([
      { path: 'contact', select: 'name phone email' },
      { path: 'assignedTo', select: 'name email' }
    ]);

    // Socket notification
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('conversation:closed', {
        conversationId: conversation._id,
        closedBy: {
          _id: req.user._id,
          name: req.user.name
        }
      });
    }

    automationEvents.conversationClosed({
      workspaceId,
      conversationId: conversation._id,
      contactId: conversation.contact?._id || conversation.contact,
      metadata: {
        closedBy: {
          _id: req.user._id,
          name: req.user.name
        },
        resolution: resolution || null
      }
    });

    console.log(`[INBOX] Conversation ${conversationId} closed by ${req.user.name}`);

    res.json({
      success: true,
      message: 'Conversation closed',
      data: conversation
    });

  } catch (err) {
    console.error('[INBOX] Close error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to close conversation',
      code: 'CLOSE_ERROR'
    });
  }
};

/**
 * Reopen conversation
 * POST /api/inbox/:conversationId/reopen
 */
exports.reopenConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const workspaceId = req.user.workspace;
    const reopenedById = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspace: workspaceId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    if (conversation.status !== 'closed' && conversation.status !== 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Conversation is not closed',
        code: 'NOT_CLOSED'
      });
    }

    conversation.updateStatus('open', reopenedById);
    await conversation.save();

    await conversation.populate([
      { path: 'contact', select: 'name phone email' },
      { path: 'assignedTo', select: 'name email' }
    ]);

    // Socket notification
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('conversation:reopened', {
        conversationId: conversation._id,
        reopenedBy: {
          _id: req.user._id,
          name: req.user.name
        }
      });
    }

    automationEvents.conversationReopened({
      workspaceId,
      conversationId: conversation._id,
      contactId: conversation.contact?._id || conversation.contact,
      metadata: {
        reopenedBy: {
          _id: req.user._id,
          name: req.user.name
        }
      }
    });

    console.log(`[INBOX] Conversation ${conversationId} reopened by ${req.user.name}`);

    res.json({
      success: true,
      message: 'Conversation reopened',
      data: conversation
    });

  } catch (err) {
    console.error('[INBOX] Reopen error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to reopen conversation',
      code: 'REOPEN_ERROR'
    });
  }
};

/**
 * Snooze conversation
 * POST /api/inbox/:conversationId/snooze
 */
exports.snoozeConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { snoozedUntil } = req.body; // ISO date string
    const workspaceId = req.user.workspace;

    if (!snoozedUntil) {
      return res.status(400).json({
        success: false,
        message: 'snoozedUntil date is required',
        code: 'MISSING_SNOOZE_DATE'
      });
    }

    const snoozeDate = new Date(snoozedUntil);
    if (snoozeDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Snooze date must be in the future',
        code: 'INVALID_SNOOZE_DATE'
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspace: workspaceId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    conversation.updateStatus('snoozed', req.user._id);
    conversation.snoozedUntil = snoozeDate;
    await conversation.save();

    await conversation.populate([
      { path: 'contact', select: 'name phone email' },
      { path: 'assignedTo', select: 'name email' }
    ]);

    // Socket notification
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('conversation:snoozed', {
        conversationId: conversation._id,
        snoozedUntil: snoozeDate,
        snoozedBy: {
          _id: req.user._id,
          name: req.user.name
        }
      });
    }

    console.log(`[INBOX] Conversation ${conversationId} snoozed until ${snoozeDate}`);

    res.json({
      success: true,
      message: `Conversation snoozed until ${snoozeDate.toISOString()}`,
      data: conversation
    });

  } catch (err) {
    console.error('[INBOX] Snooze error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to snooze conversation',
      code: 'SNOOZE_ERROR'
    });
  }
};

/**
 * Set conversation priority
 * PUT /api/inbox/:conversationId/priority
 */
exports.setPriority = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { priority } = req.body;
    const workspaceId = req.user.workspace;

    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`,
        code: 'INVALID_PRIORITY'
      });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, workspace: workspaceId },
      { priority },
      { new: true }
    ).populate([
      { path: 'contact', select: 'name phone email' },
      { path: 'assignedTo', select: 'name email' }
    ]);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    // Socket notification
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('conversation:priorityChanged', {
        conversationId: conversation._id,
        priority,
        changedBy: {
          _id: req.user._id,
          name: req.user.name
        }
      });
    }

    res.json({
      success: true,
      message: `Priority set to ${priority}`,
      data: conversation
    });

  } catch (err) {
    console.error('[INBOX] Priority error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to set priority',
      code: 'PRIORITY_ERROR'
    });
  }
};

/**
 * Set conversation label
 * PUT /api/inbox/:conversationId/label
 */
exports.setConversationLabel = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { label } = req.body;
    const workspaceId = req.user.workspace;

    if (!label || label.length > 22) {
      return res.status(400).json({
        success: false,
        message: 'Label is required and must be max 22 characters',
        code: 'INVALID_LABEL'
      });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, workspace: workspaceId },
      { label },
      { new: true }
    ).populate('contact', 'name phone profilePicture');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    // Socket notification
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('conversation:labelChanged', {
        conversationId: conversation._id,
        label,
        changedBy: { _id: req.user._id, name: req.user.name }
      });
    }

    // Trigger automation event
    const { automationEvents } = require('../../services/automation/automationEventEmitter');
    automationEvents.conversationLabelChanged({
      workspaceId,
      conversationId: conversation._id,
      contactId: conversation.contact._id,
      metadata: { label }
    });

    res.json({
      success: true,
      message: `Label set to ${label}`,
      data: conversation
    });
  } catch (err) {
    console.error('[INBOX] Label error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to set label',
      code: 'LABEL_ERROR'
    });
  }
};

/**
 * Clear conversation label
 * DELETE /api/inbox/:conversationId/label
 */
exports.clearConversationLabel = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const workspaceId = req.user.workspace;

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, workspace: workspaceId },
      { $unset: { label: "" } },
      { new: true }
    ).populate('contact', 'name phone profilePicture');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    // Socket notification
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('conversation:labelCleared', {
        conversationId: conversation._id,
        clearedBy: { _id: req.user._id, name: req.user.name }
      });
    }

    res.json({
      success: true,
      message: 'Label cleared',
      data: conversation
    });
  } catch (err) {
    console.error('[INBOX] Clear label error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to clear label',
      code: 'CLEAR_LABEL_ERROR'
    });
  }
};

/**
 * Mark conversation as spam
 * POST /api/inbox/:conversationId/spam
 */
exports.markAsSpam = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const workspaceId = req.user.workspace;

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, workspace: workspaceId },
      { status: 'spam' },
      { new: true }
    ).populate('contact', 'name phone profilePicture');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    // Socket notification
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('conversation:markedSpam', {
        conversationId: conversation._id,
        markedBy: { _id: req.user._id, name: req.user.name }
      });
    }

    res.json({
      success: true,
      message: 'Conversation marked as spam',
      data: conversation
    });
  } catch (err) {
    console.error('[INBOX] Spam error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to mark as spam',
      code: 'SPAM_ERROR'
    });
  }
};

/**
 * Unmark conversation as spam (reopen)
 * DELETE /api/inbox/:conversationId/spam
 */
exports.unmarkAsSpam = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const workspaceId = req.user.workspace;

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, workspace: workspaceId },
      { status: 'open' },
      { new: true }
    ).populate('contact', 'name phone profilePicture');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    // Socket notification
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('conversation:unmarkedSpam', {
        conversationId: conversation._id,
        unmarkedBy: { _id: req.user._id, name: req.user.name }
      });
    }

    res.json({
      success: true,
      message: 'Conversation unmarked as spam',
      data: conversation
    });
  } catch (err) {
    console.error('[INBOX] Unspam error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to unmark spam',
      code: 'UNSPAM_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// READ STATUS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mark conversation as read for current agent
 * POST /api/inbox/:conversationId/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspace: workspaceId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    // Use model method
    conversation.markReadForAgent(agentId);
    await conversation.save();

    // Socket notification (optional - for multi-device sync)
    const io = getIO();
    if (io) {
      io.to(`user:${agentId}`).emit('conversation:read', {
        conversationId: conversation._id,
        unreadCount: 0
      });
    }

    res.json({
      success: true,
      message: 'Marked as read',
      data: {
        conversationId: conversation._id,
        unreadCount: 0
      }
    });

  } catch (err) {
    console.error('[INBOX] Mark read error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to mark as read',
      code: 'MARK_READ_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// INBOX QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get inbox for current user (role-aware)
 * GET /api/inbox
 * 
 * Query params:
 * - view: 'mine' | 'unassigned' | 'all' (all only for managers)
 * - status: 'open' | 'pending' | 'closed' | 'snoozed'
 * - priority: 'low' | 'normal' | 'high' | 'urgent'
 * - page, limit
 */
exports.getInbox = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;
    const permission = await ensurePermissions(req);
    if (!permission) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or user not found. Please login again.',
        code: 'STALE_SESSION'
      });
    }

    const {
      view = 'mine',
      status,
      priority,
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = { workspace: workspaceId };

    // View-based filtering
    if (view === 'mine') {
      query.assignedTo = agentId;
      query.status = { $ne: 'spam' };
    } else if (view === 'unassigned') {
      query.assignedTo = null;
      query.status = { $ne: 'spam' };
      
      // Team isolation for unassigned
      const hasAllAccess = permission.role === 'owner' || permission.role === 'admin' || permission.role === 'manager' || permission.permissions?.viewAllConversations;
      
      if (!hasAllAccess) {
        const userTeamIds = await getUserTeamIds(workspaceId, agentId);
        if (userTeamIds.length > 0) {
          query.team = { $in: userTeamIds };
        } else {
          // Teamless agents should still see the teamless unassigned queue.
          // `null` matches both explicit null and missing team fields in MongoDB.
          query.team = null;
        }
      }
    } else if (view === 'resolved') {
      query.status = { $in: ['closed', 'resolved'] };
    } else if (view === 'snoozed') {
      query.status = 'snoozed';
    } else if (view === 'spam') {
      query.status = 'spam';
    } else if (view === 'team') {
      // Fetch user's teams
      const userTeams = await Team.find({ workspaceId, 'members.user': agentId, isActive: true }).select('_id members').lean();
      
      if (userTeams.length > 0) {
        const teamIds = userTeams.map(t => t._id);
        const memberIds = [...new Set(userTeams.flatMap(t => t.members.map(m => m.user.toString())))];
        
        query.$or = [
          { assignedTo: { $in: memberIds } },
          { team: { $in: teamIds } }
        ];
      } else {
        query.assignedTo = agentId; // Fallback to mine if no team
      }
    } else if (view === 'all') {
      // Only owners/admins/managers can view all by default
      const hasAllAccess = permission.role === 'owner' || permission.role === 'admin' || permission.role === 'manager' || permission.permissions?.viewAllConversations;
      
      if (!hasAllAccess) {
        // Find if user belongs to any teams
        const userTeams = await Team.find({ workspaceId, 'members.user': agentId, isActive: true }).select('_id visibility members').lean();
        
        if (userTeams.length > 0) {
          // If in a team, allow viewing all team conversations as a "View All" fallback
          const teamIds = userTeams.map(t => t._id);
          const memberIds = [...new Set(userTeams.flatMap(t => t.members.map(m => m.user.toString())))];
          
          query.$or = [
            { assignedTo: { $in: memberIds } },
            { team: { $in: teamIds } }
          ];
        } else {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions to view all conversations',
            code: 'PERMISSION_DENIED'
          });
        }
      }
    }

    // Status override (if explicitly provided in query)
    if (status) {
      query.status = status;
    } else if (view !== 'all' && !['resolved', 'snoozed', 'spam'].includes(view)) {
      // Default: show open and pending if not in a specific status-driven view
      query.status = { $in: ['open', 'pending'] };
    }

    // Label filter
    if (req.query.label) {
      query.label = req.query.label;
    }

    // Search (by contact name/phone)
    let contactIds = [];
    if (search) {
      const contacts = await Contact.find({
        workspace: workspaceId,
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').limit(100);

      contactIds = contacts.map(c => c._id);
      query.contact = { $in: contactIds };
    }

    // Execute query
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [conversations, total] = await Promise.all([
      Conversation.find(query)
        .populate('contact', 'name phone email profilePicture')
        .populate('assignedTo', 'name email')
        .populate('team', 'name')
        .populate('lastRepliedBy', 'name email')
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Conversation.countDocuments(query)
    ]);

    // Add per-agent unread count and compute isOpen accurately
    const now = Date.now();
    const conversationsWithUnread = conversations.map(conv => {
      const isExpired = conv.windowExpiresAt && new Date(conv.windowExpiresAt).getTime() <= now;
      return {
        ...conv,
        isOpen: conv.isOpen && !isExpired,
        myUnreadCount: conv.agentUnreadCounts?.[agentId.toString()] || 0
      };
    });

    res.json({
      success: true,
      data: conversationsWithUnread,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('[INBOX] Get inbox error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inbox',
      code: 'INBOX_ERROR'
    });
  }
};

/**
 * Get inbox statistics
 * GET /api/inbox/stats
 */
exports.getInboxStats = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;
    const permission = await ensurePermissions(req);
    if (!permission) {
      return res.status(403).json({
        success: false,
        message: 'No permissions found',
        code: 'NO_PERMISSIONS'
      });
    }

    const isManagerOrOwner = permission.role === 'owner' || permission.role === 'admin' || permission.role === 'manager';

    // Base stats for current agent
    const [
      myOpen,
      myPending,
      myClosed,
      myUnread
    ] = await Promise.all([
      Conversation.countDocuments({ workspace: workspaceId, assignedTo: agentId, status: 'open' }),
      Conversation.countDocuments({ workspace: workspaceId, assignedTo: agentId, status: 'pending' }),
      Conversation.countDocuments({ workspace: workspaceId, assignedTo: agentId, status: 'closed' }),
      Conversation.countDocuments({
        workspace: workspaceId,
        assignedTo: agentId,
        [`agentUnreadCounts.${agentId}`]: { $gt: 0 }
      })
    ]);

    const stats = {
      mine: {
        open: myOpen,
        pending: myPending,
        closed: myClosed,
        unread: myUnread,
        total: myOpen + myPending
      }
    };

    // Additional stats for managers
    if (isManagerOrOwner) {
      const [
        totalOpen,
        totalPending,
        totalClosed,
        unassigned,
        urgent
      ] = await Promise.all([
        Conversation.countDocuments({ workspace: workspaceId, status: 'open' }),
        Conversation.countDocuments({ workspace: workspaceId, status: 'pending' }),
        Conversation.countDocuments({ workspace: workspaceId, status: 'closed' }),
        Conversation.countDocuments({ workspace: workspaceId, assignedTo: null, status: { $in: ['open', 'pending'] } }),
        Conversation.countDocuments({ workspace: workspaceId, priority: 'urgent', status: { $in: ['open', 'pending'] } })
      ]);

      stats.all = {
        open: totalOpen,
        pending: totalPending,
        closed: totalClosed,
        unassigned,
        urgent,
        total: totalOpen + totalPending
      };
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (err) {
    console.error('[INBOX] Stats error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inbox stats',
      code: 'STATS_ERROR'
    });
  }
};

/**
 * Get single conversation details
 * GET /api/inbox/:conversationId
 */
exports.getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspace: workspaceId
    })
      .populate('contact')
      .populate('assignedTo', 'name email')
      .populate('team', 'name')
      .populate('assignedBy', 'name email')
      .populate('lastRepliedBy', 'name email')
      .populate('statusChangedBy', 'name email')
      .populate('assignmentHistory.assignedTo', 'name email')
      .populate('assignmentHistory.assignedBy', 'name email')
      .lean();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    // Access Control Hardening: Check if agent can view this specific conversation
    const permission = await ensurePermissions(req);
    const isOwnerOrAdmin = ['owner', 'admin', 'manager'].includes(permission?.role) || permission?.permissions?.viewAllConversations;
    
    if (!isOwnerOrAdmin) {
      const isAssigned = conversation.assignedTo?._id?.toString() === agentId.toString();
      
      if (!isAssigned) {
        // If not assigned, check if it belongs to user's team
        const userTeams = await Team.find({ workspaceId, 'members.user': agentId, isActive: true }).select('_id').lean();
        const teamIds = userTeams.map(t => t._id.toString());
        const conversationTeamId = conversation.team?._id?.toString() || conversation.team?.toString();
        
        const isTeamChat = conversationTeamId && teamIds.includes(conversationTeamId);
        
        if (!isTeamChat) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to view this conversation',
            code: 'ACCESS_DENIED'
          });
        }
      }
    }

    // Add agent-specific unread count
    conversation.myUnreadCount = conversation.agentUnreadCounts?.[agentId.toString()] || 0;
    
    // dynamically verify isOpen state
    if (conversation.windowExpiresAt && new Date(conversation.windowExpiresAt).getTime() <= Date.now()) {
      conversation.isOpen = false;
    }

    res.json({
      success: true,
      data: conversation
    });

  } catch (err) {
    console.error('[INBOX] Get conversation error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation',
      code: 'CONVERSATION_ERROR'
    });
  }
};

/**
 * Get available agents for assignment
 * GET /api/inbox/agents
 */
exports.getAvailableAgents = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const permission = await ensurePermissions(req);
    const isGlobalViewer = ['owner', 'admin', 'manager'].includes(permission?.role) || permission?.permissions?.viewAllConversations;
    const requesterTeamIds = !isGlobalViewer ? await getUserTeamIds(workspaceId, req.user._id) : [];
    const teamFilterId = req.query.team ? String(req.query.team) : (!isGlobalViewer ? (requesterTeamIds[0] || null) : null);

    // Get all active permissions in workspace
    const permissions = await Permission.find({
      workspace: workspaceId,
      isActive: true,
      role: { $in: ['owner', 'admin', 'manager', 'agent'] }
    }).populate('user', 'name email team');

    // Get conversation counts per agent
    const agentCounts = await Conversation.aggregate([
      {
        $match: {
          workspace: workspaceId,
          assignedTo: { $ne: null },
          status: { $in: ['open', 'pending'] }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = {};
    agentCounts.forEach(item => {
      countMap[item._id.toString()] = item.count;
    });

    const agents = permissions.map(p => ({
      _id: p.user._id,
      name: p.user.name,
      email: p.user.email,
      role: p.role,
      team: p.user.team || null,
      isOnline: p.isOnline || false,
      isAvailable: p.isAvailable !== false,
      maxConcurrentChats: p.maxConcurrentChats || 10,
      lastSeenAt: p.lastSeenAt || null,
      openConversations: countMap[p.user._id.toString()] || 0,
      canAccept: (countMap[p.user._id.toString()] || 0) < (p.maxConcurrentChats || 10) && p.isAvailable !== false && p.isOnline !== false
    })).filter(agent => {
      if (!teamFilterId) return true;
      const agentTeamId = agent.team?._id?.toString?.() || agent.team?.toString?.() || null;
      return agentTeamId === teamFilterId;
    });

    res.json({
      success: true,
      data: agents
    });

  } catch (err) {
    console.error('[INBOX] Get agents error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agents',
      code: 'AGENTS_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE SENDING (Stage 4)
// ═══════════════════════════════════════════════════════════════════════════

const inboxMessageService = require('../../services/messaging/inboxMessageService');

/**
 * Send text message in conversation
 * POST /api/inbox/:conversationId/messages
 * Body: { text: string }
 */
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required',
        code: 'MISSING_TEXT'
      });
    }

    const result = await inboxMessageService.sendTextMessage({
      workspaceId,
      conversationId,
      agentId,
      text: text.trim()
    });

    res.json({
      success: true,
      message: 'Message sent',
      data: {
        message: result.message,
        whatsappMessageId: result.whatsappMessageId,
        isWithin24HourWindow: result.isWithin24HourWindow,
        fallbackUsed: result.fallbackUsed,
        fallbackTemplateName: result.fallbackTemplateName
      }
    });

  } catch (err) {
    // Session window expired — agent must use a template
    if (err.message?.includes('24-hour window') || err.message?.includes('Session window expired')) {
      return res.status(400).json({
        success: false,
        message: '24-hour session window expired. Please send a template to re-engage this contact.',
        code: 'WINDOW_EXPIRED',
        requiresTemplate: true
      });
    }

    if (err.message?.startsWith('PERMISSION_DENIED')) {
      return res.status(403).json({
        success: false,
        message: err.message.replace('PERMISSION_DENIED: ', ''),
        code: 'PERMISSION_DENIED'
      });
    }

    if (err.message?.startsWith('RATE_LIMITED')) {
      return res.status(429).json({
        success: false,
        message: 'Too many messages. Please slow down.',
        code: 'RATE_LIMITED'
      });
    }

    if (err.message?.includes('opted out') || err.message?.includes('BSP_USER_OPTED_OUT')) {
      return res.status(400).json({
        success: false,
        message: 'Contact has opted out of messages.',
        code: 'CONTACT_OPTED_OUT'
      });
    }

    if (err.message?.includes('BSP_MESSAGING_BLOCKED') || err.message?.includes('BSP_GLOBAL_MESSAGING_DISABLED')) {
      return res.status(503).json({
        success: false,
        message: 'WhatsApp messaging is currently unavailable. Please try again later.',
        code: 'BSP_UNAVAILABLE'
      });
    }

    console.error('[INBOX] Send message error:', err.message);

    if (err.message?.includes('Callback Billing must be enabled')) {
      return res.status(400).json({
        success: false,
        message: 'Callback Billing must be enabled for this Gupshup app before session text sends.',
        code: 'GUPSHUP_CALLBACK_BILLING_REQUIRED',
        action: 'Enable Callback Billing in Gupshup partner app settings'
      });
    }

    if (err.message?.includes('GUPSHUP_SOURCE_NUMBER_NOT_CONFIGURED')) {
      return res.status(500).json({
        success: false,
        message: 'WhatsApp phone number not configured for this workspace.',
        code: 'PHONE_NOT_CONFIGURED'
      });
    }

    res.status(500).json({
      success: false,
      message: err.message || 'Failed to send message',
      code: 'SEND_ERROR'
    });
  }
};

/**
 * Send internal note in conversation
 * POST /api/inbox/:conversationId/notes
 * Body: { text: string }
 */
exports.sendInternalNote = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note text is required',
        code: 'MISSING_TEXT'
      });
    }

    const result = await inboxMessageService.sendInternalNote({
      workspaceId,
      conversationId,
      agentId,
      text: text.trim()
    });

    res.json({
      success: true,
      message: 'Note added',
      data: result.message
    });

  } catch (err) {
    if (err.message?.startsWith('PERMISSION_DENIED')) {
      return res.status(403).json({
        success: false,
        message: err.message.replace('PERMISSION_DENIED: ', ''),
        code: 'PERMISSION_DENIED'
      });
    }

    res.status(500).json({
      success: false,
      message: err.message || 'Failed to add note',
      code: 'NOTE_ERROR'
    });
  }
};

/**
 * Send template message in conversation
 * POST /api/inbox/:conversationId/messages/template
 * Body: { templateName: string, templateLanguage?: string, components?: array }
 */
exports.sendTemplateMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { templateName, templateLanguage, components } = req.body;
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;

    if (!templateName) {
      return res.status(400).json({
        success: false,
        message: 'Template name is required',
        code: 'MISSING_TEMPLATE'
      });
    }

    const result = await inboxMessageService.sendTemplateMessage({
      workspaceId,
      conversationId,
      agentId,
      templateName,
      templateLanguage,
      components
    });

    // ═══════════════════════════════════════════════════════════════════
    // EMIT SOCKET EVENT FOR REAL-TIME INBOX UPDATE
    // ═══════════════════════════════════════════════════════════════════
    if (result.message && conversationId) {
      try {
        const conversation = await Conversation.findById(conversationId)
          .populate('contact', 'name phone profilePicture');
        
        if (conversation && conversation.contact) {
          // Emit message update event (conversation already exists)
          await inboxSocketService.emitNewMessage(workspaceId, conversation, result.message, conversation.contact);
          console.log(`[Inbox] Emitted template message event for conversation ${conversationId}`);
        }
      } catch (socketErr) {
        console.error('[Inbox] Socket event emission failed:', socketErr.message);
        // Don't fail the overall send if socket emission fails
      }
    }

    res.json({
      success: true,
      message: 'Template sent',
      data: {
        message: result.message,
        whatsappMessageId: result.whatsappMessageId
      }
    });

  } catch (err) {
    console.error('[INBOX] Send template error:', err);

    if (err.message.startsWith('PERMISSION_DENIED')) {
      return res.status(403).json({
        success: false,
        message: err.message.replace('PERMISSION_DENIED: ', ''),
        code: 'PERMISSION_DENIED'
      });
    }

    res.status(500).json({
      success: false,
      message: err.message || 'Failed to send template',
      code: 'TEMPLATE_SEND_ERROR'
    });
  }
};

/**
 * Send media message in conversation
 * POST /api/inbox/:conversationId/messages/media
 * Body: { mediaType: string, mediaUrl: string, caption?: string, filename?: string }
 */
exports.sendMediaMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { mediaType, mediaUrl, caption, filename } = req.body;
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;

    const validTypes = ['image', 'document', 'video', 'audio', 'sticker', 'gif'];
    if (!mediaType || !validTypes.includes(mediaType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid media type. Must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_MEDIA_TYPE'
      });
    }

    if (!mediaUrl) {
      return res.status(400).json({
        success: false,
        message: 'Media URL is required',
        code: 'MISSING_MEDIA_URL'
      });
    }

    const result = await inboxMessageService.sendMediaMessage({
      workspaceId,
      conversationId,
      agentId,
      mediaType,
      mediaUrl,
      caption,
      filename
    });

    res.json({
      success: true,
      message: `${mediaType} sent`,
      data: {
        message: result.message,
        whatsappMessageId: result.whatsappMessageId
      }
    });

  } catch (err) {
    if (err.message.includes('24-hour window') || err.message.includes('Session window expired')) {
      return res.status(400).json({
        success: false,
        message: err.message,
        code: 'WINDOW_EXPIRED'
      });
    }

    if (err.message.startsWith('PERMISSION_DENIED')) {
      return res.status(403).json({
        success: false,
        message: err.message.replace('PERMISSION_DENIED: ', ''),
        code: 'PERMISSION_DENIED'
      });
    }

    console.error('[INBOX] Send media error:', err);

    res.status(500).json({
      success: false,
      message: err.message || 'Failed to send media',
      code: 'MEDIA_SEND_ERROR'
    });
  }
};

/**
 * Upload media for inbox explicitly
 * POST /api/inbox/upload-media
 */
exports.uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No media file provided' });
    }

    const mimeType = req.file.mimetype;
    let resourceType = 'auto';

    if (mimeType.startsWith('image/')) {
      resourceType = 'image';
    } else if (mimeType.startsWith('video/')) {
      resourceType = 'video';
    } else if (mimeType.startsWith('audio/')) {
      resourceType = 'video'; // Cloudinary treats audio as video resource type
    } else {
      resourceType = 'raw'; // for documents
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, resourceType);

    res.json({
      success: true,
      url: result.secure_url,
      filename: req.file.originalname,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('[INBOX] Media upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload media',
      error: error.message
    });
  }
};

/**
 * Get messages for a conversation
 * GET /api/inbox/:conversationId/messages
 * Query: page, limit, before (timestamp)
 */
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50, before } = req.query;
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;

    const result = await inboxMessageService.getConversationMessages({
      workspaceId,
      conversationId,
      agentId,
      page: parseInt(page),
      limit: parseInt(limit),
      before
    });

    res.json({
      success: true,
      data: result.messages,
      pagination: result.pagination
    });

  } catch (err) {
    console.error('[INBOX] Get messages error:', err);

    if (err.message.startsWith('PERMISSION_DENIED')) {
      return res.status(403).json({
        success: false,
        message: err.message.replace('PERMISSION_DENIED: ', ''),
        code: 'PERMISSION_DENIED'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      code: 'MESSAGES_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 4 HARDENING - SOFT LOCK / TYPING INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Signal that agent is typing (acquires soft lock)
 * POST /api/inbox/:conversationId/typing
 */
exports.agentTyping = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;

    const result = await softLockService.acquireSoftLock(
      conversationId,
      agentId,
      workspaceId
    );

    if (result.softBlocked) {
      return res.status(200).json({
        success: true,
        softBlocked: true,
        message: result.message,
        lockedBy: result.lockedBy,
        expiresAt: result.expiresAt
      });
    }

    res.json({
      success: true,
      acquired: result.acquired,
      expiresAt: result.expiresAt,
      timeoutSeconds: result.timeoutSeconds
    });

  } catch (err) {
    console.error('[INBOX] Typing error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to acquire typing lock',
      code: 'TYPING_ERROR'
    });
  }
};

/**
 * Signal that agent stopped typing (releases soft lock)
 * DELETE /api/inbox/:conversationId/typing
 */
exports.agentStoppedTyping = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;

    await softLockService.releaseSoftLock(
      conversationId,
      agentId,
      workspaceId
    );

    res.json({
      success: true,
      message: 'Typing indicator cleared'
    });

  } catch (err) {
    console.error('[INBOX] Stop typing error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to release typing lock',
      code: 'STOP_TYPING_ERROR'
    });
  }
};

/**
 * Get current soft lock status for a conversation
 * GET /api/inbox/:conversationId/lock-status
 */
exports.getLockStatus = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const result = await softLockService.getLockStatus(conversationId);

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error('[INBOX] Lock status error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get lock status',
      code: 'LOCK_STATUS_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 4 HARDENING - SLA MONITORING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get conversations that have breached SLA
 * GET /api/inbox/sla/breached
 */
exports.getSlaBreachedConversations = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { limit = 50, includeEscalated = false } = req.query;

    const result = await slaService.getSlaBreachedConversations(
      workspaceId,
      parseInt(limit),
      includeEscalated === 'true'
    );

    res.json({
      success: true,
      data: result.conversations,
      total: result.total
    });

  } catch (err) {
    console.error('[INBOX] SLA breached error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get SLA breached conversations',
      code: 'SLA_BREACHED_ERROR'
    });
  }
};

/**
 * Get SLA statistics for the workspace
 * GET /api/inbox/sla/stats
 */
exports.getSlaStats = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { period = '7d' } = req.query;

    const result = await slaService.getSlaStats(workspaceId, period);

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error('[INBOX] SLA stats error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get SLA stats',
      code: 'SLA_STATS_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 4 HARDENING - RATE LIMIT STATUS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get current agent rate limit status
 * GET /api/inbox/rate-limit/status
 */
exports.getRateLimitStatus = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const agentId = req.user._id;

    const result = await agentRateLimitService.getAgentRateLimitStatus(
      agentId,
      workspaceId
    );

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error('[INBOX] Rate limit status error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to get rate limit status',
      code: 'RATE_LIMIT_STATUS_ERROR'
    });
  }
};

/**
 * Get conversation analytics (Total, Responded, Resolved, Wait Times)
 * GET /api/v1/inbox/analytics/report
 * Query: range (7d, 30d, 90d, today), team (all, id)
 */
exports.getInboxAnalytics = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { range = '7d', team = 'all' } = req.query;

    // 1. Calculate time range
    const now = new Date();
    let start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default 7d
    
    if (range === 'today') {
      start = new Date(new Date().setHours(0, 0, 0, 0));
    } else if (range === '30d') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === '90d') {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    const end = new Date();

    // 2. Build base match query
    const matchQuery = {
      workspace: new mongoose.Types.ObjectId(workspaceId.toString()),
      conversationStartedAt: { $gte: start, $lte: end }
    };

    if (team !== 'all') {
      matchQuery.assignedTo = new mongoose.Types.ObjectId(team.toString());
    }

    // 3. Parallel aggregations for performance
    const [overviewStats, dailyTrends, tagDistribution, agentStats] = await Promise.all([
      // A. Overview Stats
      Conversation.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0] } },
            responded: { $sum: { $cond: [{ $gt: ["$firstResponseAt", null] }, 1, 0] } },
            avgResponseTime: { 
              $avg: { 
                $cond: [
                  { $gt: ["$firstResponseAt", null] },
                  { $subtract: ["$firstResponseAt", "$conversationStartedAt"] },
                  null
                ] 
              } 
            }
          }
        }
      ]),

      // B. Daily Trends
      Conversation.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$conversationStartedAt" } },
            new: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0] } }
          }
        },
        { $sort: { "_id": 1 } },
        {
          $project: {
            _id: 0,
            date: "$_id",
            new: 1,
            resolved: 1
          }
        }
      ]),

      // C. Tag Distribution (Labels)
      Conversation.aggregate([
        { $match: { ...matchQuery, label: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$label",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            name: "$_id",
            count: 1
          }
        }
      ]),

      // D. Agent Performance
      Conversation.aggregate([
        { $match: { ...matchQuery, assignedTo: { $ne: null } } },
        {
          $group: {
            _id: "$assignedTo",
            assigned: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0] } },
            avgResponseTimeMs: { 
              $avg: { 
                $cond: [
                  { $gt: ["$firstResponseAt", null] },
                  { $subtract: ["$firstResponseAt", "$conversationStartedAt"] },
                  null
                ] 
              } 
            }
          }
        }
      ])
    ]);

    // 4. Transform Agent Performance with names
    const agentIds = agentStats.map(s => s._id);
    const users = await User.find({ _id: { $in: agentIds } }).select('name role').lean();
    const userMap = users.reduce((acc, u) => {
      acc[u._id.toString()] = u;
      return acc;
    }, {});

    const agentPerformance = agentStats.map(s => {
      const user = userMap[s._id.toString()] || { name: 'Unknown', role: 'Agent' };
      // Estimate load (active vs total)
      const load = Math.round((s.assigned - s.resolved) / Math.max(s.assigned, 1) * 100);
      
      return {
        id: s._id,
        name: user.name,
        role: user.role,
        assigned: s.assigned,
        resolved: s.resolved,
        avgResponseTime: s.avgResponseTimeMs ? `${Math.round(s.avgResponseTimeMs / 60000)}m` : 'N/A',
        load: Math.max(0, isNaN(load) ? 0 : load)
      };
    });

    // 5. Build final payload
    const overview = overviewStats[0] || { total: 0, resolved: 0, responded: 0, avgResponseTime: 0 };
    
    res.json({
      success: true,
      data: {
        overview: {
          total: overview.total,
          resolved: overview.resolved,
          avgResponseTime: overview.avgResponseTime ? `${Math.round(overview.avgResponseTime / 60000)}m` : 'N/A',
          activeAgents: agentPerformance.length
        },
        dailyTrends,
        tagDistribution,
        agentPerformance
      }
    });

  } catch (err) {
    console.error('[INBOX] Analytics Report error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate analytics report',
      code: 'ANALYTICS_REPORT_ERROR'
    });
  }
};