const express = require('express');
const router = express.Router();
const integrationsController = require('../controllers/integrationsController');
const authMiddleware = require('../middlewares/auth');

/**
 * Integration Routes
 * All routes require authentication
 */

// ============================================================================
// INTEGRATION MANAGEMENT
// ============================================================================

/**
 * @route   GET /api/v1/integrations
 * @desc    List all integrations for workspace
 * @query   type - Filter by type (optional)
 * @query   status - Filter by status (optional)
 * @access  Private
 */
router.get('/', authMiddleware, integrationsController.listIntegrations);

/**
 * @route   GET /api/v1/integrations/:id
 * @desc    Get single integration details (without secrets)
 * @param   id - Integration ID
 * @access  Private
 */
router.get('/:id', authMiddleware, integrationsController.getIntegration);

/**
 * @route   POST /api/v1/integrations
 * @desc    Create new integration
 * @body    {
 *            type: "webhook",
 *            name: "Order Webhook",
 *            description: "Sync orders",
 *            config: {...},
 *            syncInterval: 0
 *          }
 * @access  Private
 */
router.post('/', authMiddleware, integrationsController.createIntegration);

/**
 * @route   PUT /api/v1/integrations/:id
 * @desc    Update integration configuration
 * @param   id - Integration ID
 * @body    {
 *            name: "Updated Name",
 *            config: {...},
 *            syncInterval: 60
 *          }
 * @access  Private
 */
router.put('/:id', authMiddleware, integrationsController.updateIntegration);

/**
 * @route   DELETE /api/v1/integrations/:id
 * @desc    Delete integration
 * @param   id - Integration ID
 * @access  Private
 */
router.delete('/:id', authMiddleware, integrationsController.deleteIntegration);

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * @route   POST /api/v1/integrations/:id/connect
 * @desc    Activate/connect an integration
 * @param   id - Integration ID
 * @access  Private
 */
router.post('/:id/connect', authMiddleware, integrationsController.connectIntegration);

/**
 * @route   POST /api/v1/integrations/:id/disconnect
 * @desc    Deactivate/disconnect an integration
 * @param   id - Integration ID
 * @access  Private
 */
router.post('/:id/disconnect', authMiddleware, integrationsController.disconnectIntegration);

/**
 * @route   POST /api/v1/integrations/:id/test-connection
 * @desc    Test if integration is still working
 * @param   id - Integration ID
 * @access  Private
 */
router.post('/:id/test-connection', authMiddleware, integrationsController.testConnection);

// ============================================================================
// CONFIGURATION & TESTING
// ============================================================================

/**
 * @route   POST /api/v1/integrations/test
 * @desc    Test integration config without saving
 * @body    {
 *            type: "webhook",
 *            config: {...}
 *          }
 * @access  Private
 */
router.post('/config/test', authMiddleware, integrationsController.testIntegration);

/**
 * @route   GET /api/v1/integrations/permissions/:type
 * @desc    Check if workspace plan allows this integration type
 * @param   type - Integration type (webhook, zapier, etc.)
 * @access  Private
 */
router.get('/permissions/:type', authMiddleware, integrationsController.checkPermissions);

// ============================================================================
// MONITORING & STATUS
// ============================================================================

/**
 * @route   GET /api/v1/integrations/sync/status
 * @desc    Get sync status for all integrations
 * @access  Private
 */
router.get('/sync/status', authMiddleware, integrationsController.getSyncStatus);

module.exports = router;
