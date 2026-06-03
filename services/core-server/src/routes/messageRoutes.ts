import { Router } from 'express';
import { messageController } from '../controllers/messageController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authenticate, messageController.getInbox);
router.get('/bootstrap', authenticate, messageController.bootstrapInbox);
router.get('/conversations', authenticate, messageController.getInbox);
router.get('/conversations/bootstrap', authenticate, messageController.bootstrapInbox);
router.get('/conversations/:conversationId/messages', authenticate, messageController.getMessages);
router.get('/messages/contact/:contactId', authenticate, messageController.getMessagesByContact);
router.post('/:conversationId/read', authenticate, (req: any, res: any) => {
  const { conversationController } = require('../controllers/conversationController');
  return conversationController.markAsRead(req, res);
});
router.post('/conversations/:conversationId/read', authenticate, (req: any, res: any) => {
  const { conversationController } = require('../controllers/conversationController');
  return conversationController.markAsRead(req, res);
});
router.post('/conversations/:conversationId/messages', authenticate, messageController.sendMessage);
router.patch('/conversations/:conversationId/action', authenticate, messageController.performConversationAction);
router.get('/:contactId/messages', authenticate, messageController.getMessages); // Keep legacy
router.post('/:contactId/messages', authenticate, messageController.sendMessage); // Keep legacy

export default router;
