/**
 * Auto-Assignment Service - Stage 4 Hardening
 * 
 * Implements fair auto-assignment strategies:
 * - ROUND_ROBIN: Rotate through available agents
 * - LEAST_ASSIGNED: Assign to agent with fewest open conversations
 * - LEAST_UNREAD: Assign to agent with lowest unread count
 * 
 * Requirements:
 * - Only assigns OPEN, unassigned conversations
 * - Respects agent online status
 * - Excludes unavailable agents
 */

const Conversation = require('../models/Conversation');
const Permission = require('../models/Permission');
const Workspace = require('../models/Workspace');
const inboxSocketService = require('./inboxSocketService');

/**
 * Get available agents for auto-assignment
 * @param {ObjectId} workspaceId 
 * @returns {Array} List of available agents
 */
async function getAvailableAgents(workspaceId) {
  const agents = await Permission.find({
    workspace: workspaceId,
    role: { $in: ['owner', 'manager', 'agent'] },
    isActive: true,
    isAvailable: true,
    isOnline: true
  })
    .populate('user', '_id name email')
    .lean();

  // Filter out agents who have reached max concurrent chats
  const agentsWithCounts = await Promise.all(
    agents.map(async (agent) => {
      const openCount = await Conversation.countDocuments({
        workspace: workspaceId,
        assignedTo: agent.user._id,
        status: { $in: ['open', 'pending'] }
      });

      return {
        ...agent,
        openConversations: openCount,
        canAccept: openCount < (agent.maxConcurrentChats || 10)
      };
    })
  );

  return agentsWithCounts.filter(a => a.canAccept);
}

/**
 * Select agent using ROUND_ROBIN strategy
 */
async function selectRoundRobin(workspaceId, availableAgents) {
  if (availableAgents.length === 0) return null;

  const workspace = await Workspace.findById(workspaceId).select('inboxSettings').lean();
  const lastIndex = workspace?.inboxSettings?.lastAssignedAgentIndex || 0;
  
  // Get next agent in rotation
  const nextIndex = (lastIndex + 1) % availableAgents.length;
  const selectedAgent = availableAgents[nextIndex];

  // Update last assigned index
  await Workspace.findByIdAndUpdate(workspaceId, {
    'inboxSettings.lastAssignedAgentIndex': nextIndex
  });

  return selectedAgent;
}

/**
 * Select agent using LEAST_ASSIGNED strategy
 */
async function selectLeastAssigned(workspaceId, availableAgents) {
  if (availableAgents.length === 0) return null;

  // Sort by open conversations (ascending)
  const sorted = [...availableAgents].sort((a, b) => 
    a.openConversations - b.openConversations
  );

  return sorted[0];
}

/**
 * Select agent using LEAST_UNREAD strategy
 */
async function selectLeastUnread(workspaceId, availableAgents) {
  if (availableAgents.length === 0) return null;

  // Calculate total unread for each agent
  const agentsWithUnread = await Promise.all(
    availableAgents.map(async (agent) => {
      const conversations = await Conversation.find({
        workspace: workspaceId,
        assignedTo: agent.user._id,
        status: { $in: ['open', 'pending'] }
      }).select('agentUnreadCounts').lean();

      let totalUnread = 0;
      conversations.forEach(conv => {
        const unread = conv.agentUnreadCounts?.get?.(agent.user._id.toString()) || 0;
        totalUnread += unread;
      });

      return {
        ...agent,
        totalUnread
      };
    })
  );

  // Sort by unread count (ascending)
  const sorted = agentsWithUnread.sort((a, b) => a.totalUnread - b.totalUnread);

  return sorted[0];
}

/**
 * Auto-assign a conversation based on workspace strategy
 * @param {ObjectId} workspaceId 
 * @param {ObjectId} conversationId 
 * @param {Object} options - { force: boolean }
 * @returns {Object} { success, agent, reason }
 */
async function autoAssignConversation(workspaceId, conversationId, options = {}) {
  try {
    // Get workspace settings
    const workspace = await Workspace.findById(workspaceId)
      .select('inboxSettings')
      .lean();

    if (!workspace?.inboxSettings?.autoAssignmentEnabled && !options.force) {
      return { 
        success: false, 
        reason: 'AUTO_ASSIGNMENT_DISABLED' 
      };
    }

    // Get conversation
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return { success: false, reason: 'CONVERSATION_NOT_FOUND' };
    }

    // Only assign open, unassigned conversations
    if (conversation.assignedTo) {
      return { success: false, reason: 'ALREADY_ASSIGNED' };
    }

    if (conversation.status !== 'open') {
      return { success: false, reason: 'NOT_OPEN' };
    }

    // Get available agents
    const availableAgents = await getAvailableAgents(workspaceId);

    if (availableAgents.length === 0) {
      return { success: false, reason: 'NO_AVAILABLE_AGENTS' };
    }

    // Select agent based on strategy
    const strategy = workspace?.inboxSettings?.assignmentStrategy || 'ROUND_ROBIN';
    let selectedAgent = null;

    switch (strategy) {
      case 'ROUND_ROBIN':
        selectedAgent = await selectRoundRobin(workspaceId, availableAgents);
        break;
      case 'LEAST_ASSIGNED':
        selectedAgent = await selectLeastAssigned(workspaceId, availableAgents);
        break;
      case 'LEAST_UNREAD':
        selectedAgent = await selectLeastUnread(workspaceId, availableAgents);
        break;
      default:
        selectedAgent = await selectRoundRobin(workspaceId, availableAgents);
    }

    if (!selectedAgent) {
      return { success: false, reason: 'SELECTION_FAILED' };
    }

    // Assign conversation
    conversation.assignTo(selectedAgent.user._id, null); // null = system assigned
    conversation.assignmentHistory.push({
      assignedTo: selectedAgent.user._id,
      assignedBy: null,
      assignedAt: new Date(),
      action: 'assigned'
    });

    await conversation.save();

    // Emit socket events
    await inboxSocketService.emitAssignment(
      workspaceId,
      conversationId,
      selectedAgent.user,
      { _id: null, name: 'System (Auto-Assign)' },
      null
    );

    console.log(`[AutoAssign] Assigned conversation ${conversationId} to ${selectedAgent.user.name} via ${strategy}`);

    return {
      success: true,
      agent: selectedAgent.user,
      strategy
    };

  } catch (err) {
    console.error('[AutoAssign] Error:', err.message);
    return { success: false, reason: 'ERROR', error: err.message };
  }
}

/**
 * Trigger auto-assignment for all unassigned open conversations
 * Called periodically or on-demand
 */
async function processUnassignedConversations(workspaceId) {
  const workspace = await Workspace.findById(workspaceId)
    .select('inboxSettings')
    .lean();

  if (!workspace?.inboxSettings?.autoAssignmentEnabled) {
    return { processed: 0, assigned: 0 };
  }

  const unassigned = await Conversation.find({
    workspace: workspaceId,
    assignedTo: null,
    status: 'open'
  }).select('_id').lean();

  let assigned = 0;

  for (const conv of unassigned) {
    const result = await autoAssignConversation(workspaceId, conv._id);
    if (result.success) {
      assigned++;
    }
  }

  return { processed: unassigned.length, assigned };
}

/**
 * Update agent online status
 */
async function setAgentOnlineStatus(workspaceId, userId, isOnline) {
  await Permission.findOneAndUpdate(
    { workspace: workspaceId, user: userId },
    { 
      isOnline, 
      lastSeenAt: new Date() 
    }
  );

  console.log(`[AutoAssign] Agent ${userId} online status: ${isOnline}`);
}

/**
 * Update agent availability
 */
async function setAgentAvailability(workspaceId, userId, isAvailable) {
  await Permission.findOneAndUpdate(
    { workspace: workspaceId, user: userId },
    { isAvailable }
  );

  console.log(`[AutoAssign] Agent ${userId} availability: ${isAvailable}`);
}

module.exports = {
  getAvailableAgents,
  autoAssignConversation,
  processUnassignedConversations,
  setAgentOnlineStatus,
  setAgentAvailability
};
