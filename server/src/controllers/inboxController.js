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

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const User = require('../models/User');
const Permission = require('../models/Permission');
const { getIO } = require('../utils/socket');
const metaService = require('../services/metaService');

// Hardening services
const softLockService = require('../services/softLockService');
const slaService = require('../services/slaService');
const agentRateLimitService = require('../services/agentRateLimitService');

async function ensurePermissions(req) {
  if (req.permissions) return req.permissions;

  const userId = req.user?._id;
  const workspaceId = req.user?.workspace;

  if (!userId || !workspaceId) return null;

  let permission = await Permission.findOne({
    workspace: workspaceId,
    user: userId
  }).lean();

  if (!permission) {
    const user = await User.findById(userId).select('role').lean();
    const role = user?.role || 'viewer';
    const defaultPermissions = Permission.getDefaultPermissions(role);

    permission = {
      role,
      permissions: defaultPermissions,
      isActive: true
    };

    Permission.create({
      workspace: workspaceId,
      user: userId,
      role,
      permissions: defaultPermissions,
      isActive: true
    }).catch(err => console.error('[INBOX] Failed to seed permissions:', err.message));
  }

  req.permissions = permission;
  return permission;
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSIGNMENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assign conversation to an agent
 * POST /api/inbox/:conversationId/assign
 * 
 * Only OWNER and MANAGER can assign conversations
 */
exports.assignConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { agentId } = req.body;
    const workspaceId = req.user.workspace;
    const assignedById = req.user._id;

    // Validate agent exists and belongs to workspace
    const agent = await User.findOne({
      _id: agentId,
      workspace: workspaceId
    }).select('_id name email');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found in this workspace',
        code: 'AGENT_NOT_FOUND'
      });
    }

    // Check agent has permission to receive assignments
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
      return res.status(403).json({
        success: false,
        message: 'No permissions found',
        code: 'NO_PERMISSIONS'
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
      return res.status(403).json({
        success: false,
        message: 'No permissions found',
        code: 'NO_PERMISSIONS'
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
    } else if (view === 'unassigned') {
      query.assignedTo = null;
    } else if (view === 'all') {
      // Only owners/managers can view all
      if (permission.role !== 'owner' && permission.role !== 'manager' && 
          !permission.permissions?.viewAllConversations) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to view all conversations',
          code: 'PERMISSION_DENIED'
        });
      }
      // No assignedTo filter - show all
    }

    // Status filter
    if (status) {
      query.status = status;
    } else {
      // Default: show open and pending (not closed)
      query.status = { $in: ['open', 'pending'] };
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
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
        .populate('lastRepliedBy', 'name email')
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Conversation.countDocuments(query)
    ]);

    // Add per-agent unread count
    const conversationsWithUnread = conversations.map(conv => ({
      ...conv,
      myUnreadCount: conv.agentUnreadCounts?.[agentId.toString()] || 0
    }));

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

    const isManagerOrOwner = permission.role === 'owner' || permission.role === 'manager';

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

    // Add agent-specific unread count
    conversation.myUnreadCount = conversation.agentUnreadCounts?.[agentId.toString()] || 0;

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

    // Get all active permissions in workspace
    const permissions = await Permission.find({
      workspace: workspaceId,
      isActive: true,
      role: { $in: ['owner', 'manager', 'agent'] }
    }).populate('user', 'name email');

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
      activeConversations: countMap[p.user._id.toString()] || 0
    }));

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

const inboxMessageService = require('../services/inboxMessageService');

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
        isWithin24HourWindow: result.isWithin24HourWindow
      }
    });

  } catch (err) {
    console.error('[INBOX] Send message error:', err);
    
    if (err.message.startsWith('PERMISSION_DENIED')) {
      return res.status(403).json({
        success: false,
        message: err.message.replace('PERMISSION_DENIED: ', ''),
        code: 'PERMISSION_DENIED'
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

    const validTypes = ['image', 'document', 'video', 'audio'];
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
    console.error('[INBOX] Send media error:', err);
    
    if (err.message.startsWith('PERMISSION_DENIED')) {
      return res.status(403).json({
        success: false,
        message: err.message.replace('PERMISSION_DENIED: ', ''),
        code: 'PERMISSION_DENIED'
      });
    }

    if (err.message.includes('24-hour window')) {
      return res.status(400).json({
        success: false,
        message: err.message,
        code: 'WINDOW_EXPIRED'
      });
    }

    res.status(500).json({
      success: false,
      message: err.message || 'Failed to send media',
      code: 'MEDIA_SEND_ERROR'
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