/**
 * Inbox Send Routes — Shortcut Endpoints
 * 
 * Provides a convenience endpoint that accepts (conversationId, text)
 * in the request body rather than in the URL path.
 * 
 * POST /api/v1/inbox/messages
 * Body: { conversationId, text }
 * 
 * This mirrors the Interakt-style API where the inbox sends messages
 * with a flat payload, not a path-based conversation ID.
 * 
 * The full per-conversation routes still exist at:
 *   POST /api/v1/inbox/:conversationId/messages
 */

const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');

/**
 * POST /api/v1/inbox/messages
 * 
 * Send a text message from inbox (agent-initiated).
 * 
 * Body:
 *   conversationId {string}  - Target conversation ID
 *   text           {string}  - Message text
 * 
 * Requires auth. Delegates to inboxMessageService.sendTextMessage()
 * which enforces:
 *   - Permission checks
 *   - Rate limiting  
 *   - 24h session window (via bspMessagingService)
 *   - Opt-out compliance
 */
router.post('/messages', auth, async (req, res) => {
    try {
        const { conversationId, text } = req.body;

        if (!conversationId || !text) {
            return res.status(400).json({
                success: false,
                message: 'conversationId and text are required'
            });
        }

        if (typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'text must be a non-empty string'
            });
        }

        if (text.trim().length > 4096) {
            return res.status(400).json({
                success: false,
                message: 'text exceeds 4096 character WhatsApp limit'
            });
        }

        const workspaceId = req.workspace?._id || req.user?.currentWorkspace;
        const agentId = req.user?._id;

        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Workspace context missing' });
        }

        const inboxMessageService = require('../../services/messaging/inboxMessageService');

        const result = await inboxMessageService.sendTextMessage({
            workspaceId,
            conversationId,
            agentId,
            text: text.trim()
        });

        // Check session window status for response metadata
        const gupshupPartnerSendService = require('../../services/bsp/gupshupPartnerSendService');
        const { Conversation } = require('../../models');
        const conversation = await Conversation.findById(conversationId).select('windowExpiresAt isOpen').lean();
        const sessionWindowOpen = !!(
            conversation?.isOpen &&
            conversation?.windowExpiresAt &&
            new Date(conversation.windowExpiresAt) > new Date()
        );

        return res.status(200).json({
            success: true,
            message: result.message,
            whatsappMessageId: result.whatsappMessageId,
            sessionWindowOpen,
            windowExpiresAt: conversation?.windowExpiresAt || null
        });
    } catch (error) {
        console.error('[InboxSendRoutes] Error sending message:', error.message);

        // Map known errors to appropriate HTTP codes
        if (error.message?.includes('PERMISSION_DENIED')) {
            return res.status(403).json({ success: false, message: error.message });
        }
        if (error.message?.includes('RATE_LIMITED')) {
            return res.status(429).json({ success: false, message: error.message });
        }
        if (error.message?.includes('Session window')) {
            return res.status(400).json({
                success: false,
                message: '24-hour session window expired. Please send a template message to re-open the conversation.',
                sessionWindowOpen: false,
                requiresTemplate: true
            });
        }
        if (error.message?.includes('opted out') || error.message?.includes('BSP_USER_OPTED_OUT')) {
            return res.status(400).json({ success: false, message: 'Contact has opted out of messages' });
        }

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to send message'
        });
    }
});

/**
 * GET /api/v1/inbox/messages/session
 * 
 * Check the 24h session window status for a conversation.
 * 
 * Query: conversationId
 * 
 * Returns: { open, expiresAt, minutesRemaining }
 */
router.get('/messages/session', auth, async (req, res) => {
    try {
        const { conversationId } = req.query;
        if (!conversationId) {
            return res.status(400).json({ success: false, message: 'conversationId required' });
        }

        const { Conversation } = require('../../models');
        const conversation = await Conversation.findById(conversationId)
            .select('windowExpiresAt isOpen workspace')
            .lean();

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }

        const workspaceId = req.workspace?._id || req.user?.currentWorkspace;
        if (conversation.workspace.toString() !== workspaceId.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const now = new Date();
        const expiresAt = conversation.windowExpiresAt ? new Date(conversation.windowExpiresAt) : null;
        const open = !!(conversation.isOpen && expiresAt && expiresAt > now);
        const minutesRemaining = open
            ? Math.floor((expiresAt - now) / 60000)
            : 0;

        return res.json({
            success: true,
            sessionWindowOpen: open,
            expiresAt: expiresAt?.toISOString() || null,
            minutesRemaining,
            requiresTemplate: !open
        });
    } catch (error) {
        console.error('[InboxSendRoutes] Session check error:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
