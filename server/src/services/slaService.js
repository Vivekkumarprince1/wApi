/**
 * SLA Enforcement Service - Stage 4 Hardening
 * 
 * Tracks SLA deadlines and detects breaches:
 * - No first response within SLA window → breach
 * - On breach: flag, increase priority, notify managers
 */

const Conversation = require('../models/Conversation');
const Workspace = require('../models/Workspace');
const Permission = require('../models/Permission');
const inboxSocketService = require('./inboxSocketService');
const { getIO } = require('../utils/socket');

/**
 * Set SLA deadline for a conversation
 * Called when a new customer message is received
 */
async function setSlaDeadline(conversationId, workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId)
      .select('inboxSettings')
      .lean();

    if (!workspace?.inboxSettings?.slaEnabled) {
      return { success: false, reason: 'SLA_DISABLED' };
    }

    const slaMinutes = workspace.inboxSettings.slaFirstResponseMinutes || 60;
    const deadline = new Date(Date.now() + slaMinutes * 60 * 1000);

    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        slaDeadline: deadline,
        slaBreached: false,
        slaBreachedAt: null
      },
      { new: true }
    );

    if (!conversation) {
      return { success: false, reason: 'CONVERSATION_NOT_FOUND' };
    }

    console.log(`[SLA] Set deadline for ${conversationId}: ${deadline.toISOString()}`);

    return { 
      success: true, 
      deadline,
      minutesRemaining: slaMinutes
    };

  } catch (err) {
    console.error('[SLA] Error setting deadline:', err.message);
    return { success: false, reason: 'ERROR', error: err.message };
  }
}

/**
 * Clear SLA deadline (called when agent responds)
 */
async function clearSlaDeadline(conversationId, agentId) {
  try {
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return { success: false, reason: 'CONVERSATION_NOT_FOUND' };
    }

    // Only clear if this is the first response
    if (!conversation.firstResponseAt) {
      conversation.firstResponseAt = new Date();
      conversation.firstResponseBy = agentId;
    }

    // Clear SLA tracking
    conversation.slaDeadline = null;
    
    await conversation.save();

    console.log(`[SLA] Cleared deadline for ${conversationId} (first response by ${agentId})`);

    return { success: true };

  } catch (err) {
    console.error('[SLA] Error clearing deadline:', err.message);
    return { success: false, reason: 'ERROR', error: err.message };
  }
}

/**
 * Check for SLA breaches (called periodically)
 */
async function checkSlaBreaches(workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId)
      .select('inboxSettings')
      .lean();

    if (!workspace?.inboxSettings?.slaEnabled) {
      return { checked: 0, breached: 0 };
    }

    const now = new Date();

    // Find conversations with passed SLA deadline that haven't been flagged
    const breachedConversations = await Conversation.find({
      workspace: workspaceId,
      slaDeadline: { $lt: now },
      slaBreached: false,
      firstResponseAt: null, // No first response yet
      status: { $in: ['open', 'pending'] }
    });

    let breachedCount = 0;

    for (const conversation of breachedConversations) {
      await handleSlaBreach(conversation, workspace);
      breachedCount++;
    }

    return { 
      checked: breachedConversations.length, 
      breached: breachedCount 
    };

  } catch (err) {
    console.error('[SLA] Error checking breaches:', err.message);
    return { checked: 0, breached: 0, error: err.message };
  }
}

/**
 * Handle SLA breach
 */
async function handleSlaBreach(conversation, workspace) {
  try {
    const conversationId = conversation._id;
    const workspaceId = conversation.workspace;

    // Flag as breached
    conversation.slaBreached = true;
    conversation.slaBreachedAt = new Date();

    // Increase priority if auto-escalate enabled
    if (workspace?.inboxSettings?.slaBreachAutoEscalate) {
      if (conversation.priority === 'low') {
        conversation.priority = 'normal';
      } else if (conversation.priority === 'normal') {
        conversation.priority = 'high';
      } else if (conversation.priority === 'high') {
        conversation.priority = 'urgent';
      }

      conversation.slaEscalatedAt = new Date();
    }

    await conversation.save();

    // Notify managers via socket
    const managers = await Permission.find({
      workspace: workspaceId,
      role: { $in: ['owner', 'manager'] },
      isActive: true
    }).select('user').lean();

    const io = getIO();
    if (io) {
      // Notify workspace
      io.to(`workspace:${workspaceId}`).emit('inbox:sla-breach', {
        conversationId,
        contactId: conversation.contact,
        breachedAt: conversation.slaBreachedAt,
        newPriority: conversation.priority,
        assignedTo: conversation.assignedTo
      });

      // Notify each manager directly
      for (const manager of managers) {
        io.to(`user:${manager.user}`).emit('inbox:sla-breach-alert', {
          conversationId,
          breachedAt: conversation.slaBreachedAt,
          message: 'SLA breach: No first response within deadline'
        });
      }
    }

    console.log(`[SLA] Breach flagged for ${conversationId}, priority now: ${conversation.priority}`);

    return { success: true };

  } catch (err) {
    console.error('[SLA] Error handling breach:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get SLA-breached conversations for a workspace
 */
async function getSlaBreachedConversations(workspaceId, options = {}) {
  const { page = 1, limit = 20 } = options;

  const conversations = await Conversation.find({
    workspace: workspaceId,
    slaBreached: true,
    status: { $in: ['open', 'pending'] }
  })
    .populate('contact', 'name phone')
    .populate('assignedTo', 'name email')
    .sort({ slaBreachedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await Conversation.countDocuments({
    workspace: workspaceId,
    slaBreached: true,
    status: { $in: ['open', 'pending'] }
  });

  return {
    conversations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get SLA statistics for a workspace
 */
async function getSlaStats(workspaceId) {
  const now = new Date();

  const [
    totalOpen,
    withDeadline,
    breached,
    atRisk // Deadline within 15 minutes
  ] = await Promise.all([
    Conversation.countDocuments({
      workspace: workspaceId,
      status: { $in: ['open', 'pending'] },
      firstResponseAt: null
    }),
    Conversation.countDocuments({
      workspace: workspaceId,
      slaDeadline: { $ne: null },
      slaBreached: false,
      firstResponseAt: null
    }),
    Conversation.countDocuments({
      workspace: workspaceId,
      slaBreached: true,
      status: { $in: ['open', 'pending'] }
    }),
    Conversation.countDocuments({
      workspace: workspaceId,
      slaDeadline: { 
        $gt: now, 
        $lt: new Date(now.getTime() + 15 * 60 * 1000) 
      },
      slaBreached: false,
      firstResponseAt: null
    })
  ]);

  return {
    totalAwaitingResponse: totalOpen,
    withActiveSla: withDeadline,
    breached,
    atRisk
  };
}

module.exports = {
  setSlaDeadline,
  clearSlaDeadline,
  checkSlaBreaches,
  handleSlaBreach,
  getSlaBreachedConversations,
  getSlaStats
};
