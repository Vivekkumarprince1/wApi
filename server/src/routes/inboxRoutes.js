/**
 * Inbox Routes - Stage 4
 * Shared Inbox & Agent Roles API endpoints
 * 
 * All routes require authentication via auth middleware
 * RBAC middleware enforces role-based permissions
 */

const express = require('express');
const router = express.Router();
const inboxController = require('../controllers/inboxController');
const auth = require('../middlewares/auth');
const { 
  requireRole, 
  requirePermission, 
  requireConversationAccess 
} = require('../middlewares/rbac');

// ═══════════════════════════════════════════════════════════════════════════
// INBOX QUERIES (All authenticated users)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/inbox
 * Get inbox conversations based on view (mine/unassigned/all)
 * Query params: view, status, priority, search, page, limit
 */
router.get('/', auth, inboxController.getInbox);

/**
 * GET /api/inbox/stats
 * Get inbox statistics (counts by status, unread, etc.)
 */
router.get('/stats', auth, inboxController.getInboxStats);

/**
 * GET /api/inbox/agents
 * Get available agents for assignment (managers only)
 */
router.get('/agents', 
  auth, 
  requireRole(['owner', 'manager']), 
  inboxController.getAvailableAgents
);

/**
 * GET /api/inbox/:conversationId
 * Get single conversation details
 * Agents can only access their assigned conversations
 */
router.get('/:conversationId', 
  auth, 
  requireConversationAccess('conversationId'),
  inboxController.getConversation
);

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE OPERATIONS (Stage 4)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/inbox/:conversationId/messages
 * Get messages for a conversation
 * Query params: page, limit, before
 */
router.get('/:conversationId/messages',
  auth,
  requireConversationAccess('conversationId'),
  inboxController.getMessages
);

/**
 * POST /api/inbox/:conversationId/messages
 * Send text message in conversation
 * Body: { text: string }
 */
router.post('/:conversationId/messages',
  auth,
  requireConversationAccess('conversationId'),
  requirePermission('sendMessages'),
  inboxController.sendMessage
);

/**
 * POST /api/inbox/:conversationId/messages/template
 * Send template message in conversation
 * Body: { templateName: string, templateLanguage?: string, components?: array }
 */
router.post('/:conversationId/messages/template',
  auth,
  requireConversationAccess('conversationId'),
  requirePermission('sendMessages'),
  inboxController.sendTemplateMessage
);

/**
 * POST /api/inbox/:conversationId/messages/media
 * Send media message in conversation
 * Body: { mediaType: string, mediaUrl: string, caption?: string, filename?: string }
 */
router.post('/:conversationId/messages/media',
  auth,
  requireConversationAccess('conversationId'),
  requirePermission('sendMessages'),
  inboxController.sendMediaMessage
);

// ═══════════════════════════════════════════════════════════════════════════
// ASSIGNMENT OPERATIONS (Managers & Owners)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/inbox/:conversationId/assign
 * Assign conversation to an agent
 * Body: { agentId: string }
 */
router.post('/:conversationId/assign', 
  auth, 
  requirePermission('assignConversations'),
  inboxController.assignConversation
);

/**
 * POST /api/inbox/:conversationId/unassign
 * Remove assignment from conversation
 */
router.post('/:conversationId/unassign', 
  auth, 
  requirePermission('assignConversations'),
  inboxController.unassignConversation
);

/**
 * POST /api/inbox/:conversationId/claim
 * Agent self-assigns from unassigned pool
 */
router.post('/:conversationId/claim', 
  auth,
  requirePermission('sendMessages'), // Any agent who can send messages can claim
  inboxController.claimConversation
);

// ═══════════════════════════════════════════════════════════════════════════
// STATUS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/inbox/:conversationId/close
 * Close a conversation
 * Body: { resolution?: string }
 */
router.post('/:conversationId/close', 
  auth, 
  requireConversationAccess('conversationId'),
  inboxController.closeConversation
);

/**
 * POST /api/inbox/:conversationId/reopen
 * Reopen a closed conversation
 */
router.post('/:conversationId/reopen', 
  auth, 
  requireConversationAccess('conversationId'),
  inboxController.reopenConversation
);

/**
 * POST /api/inbox/:conversationId/snooze
 * Snooze conversation until specified time
 * Body: { snoozedUntil: ISO date string }
 */
router.post('/:conversationId/snooze', 
  auth, 
  requireConversationAccess('conversationId'),
  inboxController.snoozeConversation
);

/**
 * PUT /api/inbox/:conversationId/priority
 * Set conversation priority
 * Body: { priority: 'low' | 'normal' | 'high' | 'urgent' }
 */
router.put('/:conversationId/priority', 
  auth, 
  requireConversationAccess('conversationId'),
  inboxController.setPriority
);

// ═══════════════════════════════════════════════════════════════════════════
// READ STATUS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/inbox/:conversationId/read
 * Mark conversation as read for current agent
 */
router.post('/:conversationId/read', 
  auth, 
  requireConversationAccess('conversationId'),
  inboxController.markAsRead
);

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 4 HARDENING - SOFT LOCK & TYPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/inbox/:conversationId/typing
 * Signal that agent is typing (acquires soft lock)
 * Prevents reply collisions
 */
router.post('/:conversationId/typing',
  auth,
  requireConversationAccess('conversationId'),
  inboxController.agentTyping
);

/**
 * DELETE /api/inbox/:conversationId/typing
 * Signal that agent stopped typing (releases soft lock)
 */
router.delete('/:conversationId/typing',
  auth,
  requireConversationAccess('conversationId'),
  inboxController.agentStoppedTyping
);

/**
 * GET /api/inbox/:conversationId/lock-status
 * Get current soft lock status for a conversation
 */
router.get('/:conversationId/lock-status',
  auth,
  requireConversationAccess('conversationId'),
  inboxController.getLockStatus
);

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 4 HARDENING - SLA & RATE LIMITS (Manager endpoints)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/inbox/sla/breached
 * Get conversations that have breached SLA
 */
router.get('/sla/breached',
  auth,
  requireRole(['owner', 'manager']),
  inboxController.getSlaBreachedConversations
);

/**
 * GET /api/inbox/sla/stats
 * Get SLA statistics for the workspace
 */
router.get('/sla/stats',
  auth,
  requireRole(['owner', 'manager']),
  inboxController.getSlaStats
);

/**
 * GET /api/inbox/rate-limit/status
 * Get current agent rate limit status
 */
router.get('/rate-limit/status',
  auth,
  inboxController.getRateLimitStatus
);

module.exports = router;
