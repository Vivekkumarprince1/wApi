const express = require('express');
const auth = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/infrastructure/rbac');
const { planCheck, bulkPlanCheck, checkTokenExpiry } = require('../../middlewares/infrastructure/planCheck');
const { createWorkspaceRateLimiter } = require('../../middlewares/infrastructure/workspaceRateLimit');
const { checkPhoneThroughput } = require('../../middlewares/infrastructure/phoneThroughputMiddleware');
const { sendMessage, sendTemplateMessage, sendBulkTemplateMessage } = require('../../controllers/messaging/messageController');

const router = express.Router();
router.use(auth);

// Apply workspace-level rate limiting for messaging
const messagingRateLimiter = createWorkspaceRateLimiter('messaging');

// ✅ Check token expiry + workspace rate limiting + phone throughput + plan checks + RBAC
router.post('/send', 
  messagingRateLimiter, 
  checkTokenExpiry, 
  requirePermission('sendMessages'),
  checkPhoneThroughput, 
  planCheck('messages', 1), 
  sendMessage
);

router.post('/template', 
  messagingRateLimiter, 
  checkTokenExpiry, 
  requirePermission('sendMessages'),
  checkPhoneThroughput, 
  planCheck('messages', 1), 
  sendTemplateMessage
);
router.post('/bulk-template', 
  messagingRateLimiter, 
  checkTokenExpiry, 
  requirePermission('sendMessages'),
  checkPhoneThroughput, 
  bulkPlanCheck('messages'), 
  sendBulkTemplateMessage
);

module.exports = router;

