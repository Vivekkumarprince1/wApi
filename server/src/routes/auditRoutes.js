const express = require('express');
const auth = require('../middlewares/auth');
const { listAuditLogs, exportAuditLogs } = require('../controllers/auditController');

const router = express.Router();

// All audit log routes are workspace-scoped and require authentication.
router.use(auth);

// List audit logs for current workspace
router.get('/', listAuditLogs);

// Export audit logs (json or csv)
router.get('/export', exportAuditLogs);

module.exports = router;

