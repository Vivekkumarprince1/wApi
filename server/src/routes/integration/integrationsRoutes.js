const express = require('express');
const router = express.Router();
const integrationsController = require('../../controllers/integration/integrationsController');
const appController = require('../../controllers/integration/appController');
const authMiddleware = require('../../middlewares/auth');

// ============================================================================
// APP CATALOG (INTERAKT-LIKE)
// ============================================================================

router.get('/catalog', authMiddleware, appController.getAvailableApps);
router.post('/catalog/:appSlug/connect', authMiddleware, appController.connectApiKeyApp);
router.post('/catalog/:appSlug/disconnect', authMiddleware, appController.disconnectApp);


// ============================================================================
// INTEGRATION MANAGEMENT (EXISTING)
// ============================================================================

router.get('/', authMiddleware, integrationsController.listIntegrations);
router.get('/:id', authMiddleware, integrationsController.getIntegration);
router.post('/', authMiddleware, integrationsController.createIntegration);
router.put('/:id', authMiddleware, integrationsController.updateIntegration);
router.delete('/:id', authMiddleware, integrationsController.deleteIntegration);

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================
router.post('/:id/connect', authMiddleware, integrationsController.connectIntegration);
router.post('/:id/disconnect', authMiddleware, integrationsController.disconnectIntegration);
router.post('/:id/test-connection', authMiddleware, integrationsController.testConnection);

// ============================================================================
// CONFIGURATION & TESTING
// ============================================================================
router.post('/config/test', authMiddleware, integrationsController.testIntegration);
router.get('/permissions/:type', authMiddleware, integrationsController.checkPermissions);

// ============================================================================
// MONITORING & STATUS
// ============================================================================
router.get('/sync/status', authMiddleware, integrationsController.getSyncStatus);

module.exports = router;
