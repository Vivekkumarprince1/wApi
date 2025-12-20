const express = require('express');
const auth = require('../middlewares/auth');
const { sendMessage, sendTemplateMessage, sendBulkTemplateMessage } = require('../controllers/messageController');

const router = express.Router();
router.use(auth);
router.post('/send', sendMessage);
router.post('/template', sendTemplateMessage);
router.post('/bulk-template', sendBulkTemplateMessage);

module.exports = router;
