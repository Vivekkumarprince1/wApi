const express = require('express');
const auth = require('../middlewares/auth');
const {
  listConversations,
  getConversationByContact,
  getMessageThread,
  updateConversation,
  markAsRead
} = require('../controllers/conversationController');

const router = express.Router();

router.use(auth);

router.get('/', listConversations);
router.get('/:contactId', getConversationByContact);
router.get('/:contactId/messages', getMessageThread);
router.put('/:contactId', updateConversation);
router.post('/:contactId/read', markAsRead);

module.exports = router;
