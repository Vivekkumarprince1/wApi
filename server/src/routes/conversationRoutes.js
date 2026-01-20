const express = require('express');
const auth = require('../middlewares/auth');
const {
  listConversations,
  getConversationByContact,
  getMessageThread,
  updateConversation,
  markAsRead
} = require('../controllers/conversationController');
const tagsController = require('../controllers/tagsController');

const router = express.Router();

router.use(auth);

router.get('/', listConversations);
router.get('/:contactId', getConversationByContact);
router.get('/:contactId/messages', getMessageThread);
router.put('/:contactId', updateConversation);
router.post('/:contactId/read', markAsRead);

// Stage 5: CRM Tagging
router.post('/:conversationId/tags', tagsController.addTagsToConversation);
router.delete('/:conversationId/tags', tagsController.removeTagsFromConversation);

module.exports = router;
