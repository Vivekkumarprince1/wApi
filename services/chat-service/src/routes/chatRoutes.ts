import { Router } from 'express';
import {
  getConversationsInternal,
  getTimelineMessagesInternal,
  patchConversationStatusInternal,
  getConversationsPublic,
  getTimelineMessagesPublic,
  patchConversationStatusPublic,
  sendMessageInternal,
  sendMessagePublic,
  sendTemplateToContactPublic,
  getBootstrapDataPublic,
  markAsReadPublic,
  performConversationActionPublic,
  getMessagesByContactPublic
} from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';
import { internalAuth } from './internalRoutes.js';

const router = Router();

// Internal Gateway endpoints
router.get('/internal/v1/inbox/conversations', internalAuth, getConversationsInternal);
router.get('/internal/v1/inbox/conversations/:id/messages', internalAuth, getTimelineMessagesInternal);
router.patch('/internal/v1/inbox/conversations/:id/status', internalAuth, patchConversationStatusInternal);

// Authenticated Client-Gateway endpoints

// 1. Inbox listings
router.get('/api/v1/inbox', authenticate, getConversationsPublic);
router.get('/inbox', authenticate, getConversationsPublic);
router.get('/api/v1/inbox/conversations', authenticate, getConversationsPublic);
router.get('/inbox/conversations', authenticate, getConversationsPublic);
router.get('/conversations', authenticate, getConversationsPublic);

// 2. Bootstrap Cold Start
router.get('/api/v1/inbox/bootstrap', authenticate, getBootstrapDataPublic);
router.get('/inbox/bootstrap', authenticate, getBootstrapDataPublic);
router.get('/api/v1/inbox/conversations/bootstrap', authenticate, getBootstrapDataPublic);
router.get('/inbox/conversations/bootstrap', authenticate, getBootstrapDataPublic);
router.get('/conversations/bootstrap', authenticate, getBootstrapDataPublic);

// 3. Timeline / Message history
router.get('/api/v1/inbox/conversations/:id/messages', authenticate, getTimelineMessagesPublic);
router.get('/inbox/conversations/:id/messages', authenticate, getTimelineMessagesPublic);
router.get('/conversations/:id/messages', authenticate, getTimelineMessagesPublic);

router.get('/api/v1/inbox/messages/contact/:contactId', authenticate, getMessagesByContactPublic);
router.get('/inbox/messages/contact/:contactId', authenticate, getMessagesByContactPublic);

// 4. Mark read
router.post('/api/v1/inbox/conversations/:id/read', authenticate, markAsReadPublic);
router.post('/inbox/conversations/:id/read', authenticate, markAsReadPublic);
router.post('/conversations/:id/read', authenticate, markAsReadPublic);

// 5. Actions (assign, snooze, Spam, etc.)
router.patch('/api/v1/inbox/conversations/:id/action', authenticate, performConversationActionPublic);
router.patch('/inbox/conversations/:id/action', authenticate, performConversationActionPublic);
router.patch('/conversations/:id/action', authenticate, performConversationActionPublic);

// 6. Status change (Legacy status endpoint)
router.patch('/api/v1/inbox/conversations/:id/status', authenticate, patchConversationStatusPublic);
router.patch('/inbox/conversations/:id/status', authenticate, patchConversationStatusPublic);
router.patch('/conversations/:id/status', authenticate, patchConversationStatusPublic);

// Outbound Message endpoints
router.post('/internal/v1/inbox/conversations/:id/messages', internalAuth, sendMessageInternal);
router.post('/api/v1/inbox/conversations/:id/messages', authenticate, sendMessagePublic);
router.post('/inbox/conversations/:id/messages', authenticate, sendMessagePublic);
router.post('/conversations/:id/messages', authenticate, sendMessagePublic);

// Send a template directly to a contact (gateway maps /api/v1/contacts/:id/send-template here)
router.post('/api/v1/contacts/:contactId/send-template', authenticate, sendTemplateToContactPublic);
router.post('/api/v1/inbox/contacts/:contactId/send-template', authenticate, sendTemplateToContactPublic);
router.post('/inbox/contacts/:contactId/send-template', authenticate, sendTemplateToContactPublic);

// Monolith root-param aliases — registered last so the specific routes above win.
router.post('/api/v1/inbox/:id/read', authenticate, markAsReadPublic);
router.get('/api/v1/inbox/:contactId/messages', authenticate, getMessagesByContactPublic);

export default router;
