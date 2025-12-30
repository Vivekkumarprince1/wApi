const express = require('express');
const auth = require('../middlewares/auth');
const { planCheck, bulkPlanCheck, checkTokenExpiry } = require('../middlewares/planCheck');
const { sendMessage, sendTemplateMessage, sendBulkTemplateMessage } = require('../controllers/messageController');

const router = express.Router();
router.use(auth);
// ✅ Check token expiry before allowing messages
router.post('/send', checkTokenExpiry, planCheck('messages', 1), sendMessage);
router.post('/template', checkTokenExpiry, planCheck('messages', 1), sendTemplateMessage);
router.post('/bulk-template', checkTokenExpiry, bulkPlanCheck('messages'), sendBulkTemplateMessage);

module.exports = router;
