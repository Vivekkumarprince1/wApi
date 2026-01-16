const express = require('express');
const auth = require('../middlewares/auth');
const { planCheck, bulkPlanCheck, checkTokenExpiry } = require('../middlewares/planCheck');
const { createWorkspaceRateLimiter } = require('../middlewares/workspaceRateLimit');
const { checkPhoneThroughput } = require('../middlewares/phoneThroughputMiddleware');
const { sendMessage, sendTemplateMessage, sendBulkTemplateMessage } = require('../controllers/messageController');

const router = express.Router();
router.use(auth);

// Apply workspace-level rate limiting for messaging
const messagingRateLimiter = createWorkspaceRateLimiter('messaging');

// ✅ Check token expiry + workspace rate limiting + phone throughput + plan checks
router.post('/send', messagingRateLimiter, checkTokenExpiry, checkPhoneThroughput, planCheck('messages', 1), sendMessage);
router.post('/template', messagingRateLimiter, checkTokenExpiry, checkPhoneThroughput, planCheck('messages', 1), sendTemplateMessage);
router.post('/bulk-template', messagingRateLimiter, checkTokenExpiry, checkPhoneThroughput, bulkPlanCheck('messages'), sendBulkTemplateMessage);

module.exports = router;

