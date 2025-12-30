const IntegrationService = require('../services/integrationService');
const Integration = require('../models/Integration');

/**
 * Integration Controller - HTTP handlers for integration APIs
 * 
 * Rules:
 * - All endpoints require JWT auth
 * - Plan permissions enforced
 * - Secrets never exposed in responses
 * - Error logging enabled
 */

/**
 * GET /integrations
 * List all integrations for workspace
 * 
 * Query params:
 * - type: Filter by type (webhook, google_sheets, etc.)
 * - status: Filter by status (connected, disconnected)
 */
async function listIntegrations(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { type, status } = req.query;

    const filters = {};
    if (type) filters.type = type;
    if (status) filters.status = status;

    const integrations = await IntegrationService.getIntegrations(workspace, filters);

    res.json({
      success: true,
      data: integrations,
      count: integrations.length
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /integrations/:id
 * Get single integration details (without secrets)
 */
async function getIntegration(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { id } = req.params;

    const integration = await IntegrationService.getIntegration(id, workspace, false);

    res.json({
      success: true,
      data: integration
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /integrations
 * Create new integration
 * 
 * Body:
 * {
 *   type: "webhook",
 *   name: "Order Webhook",
 *   description: "Sync orders to external system",
 *   config: { ... },
 *   syncInterval: 0
 * }
 */
async function createIntegration(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const userId = req.user._id;
    const { type, name, description, config, syncInterval, syncDirection } = req.body;

    // Validate required fields
    if (!type || !name || !config) {
      return res.status(400).json({
        success: false,
        error: 'type, name, and config are required'
      });
    }

    const integration = await IntegrationService.createIntegration(
      workspace,
      { type, name, description, config, syncInterval, syncDirection },
      userId
    );

    res.status(201).json({
      success: true,
      data: integration,
      message: 'Integration created successfully'
    });
  } catch (err) {
    // Log integration creation errors for audit
    console.error(`[Integration] Create failed for ${req.user.email}:`, err.message);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /integrations/:id/test
 * Test integration connection without saving
 * 
 * Body:
 * {
 *   type: "webhook",
 *   config: { ... }
 * }
 */
async function testIntegration(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { type, config } = req.body;

    if (!type || !config) {
      return res.status(400).json({
        success: false,
        error: 'type and config are required'
      });
    }

    const result = await IntegrationService.testIntegration(workspace, type, config);

    res.json({
      success: result.success,
      data: result
    });
  } catch (err) {
    console.error('[Integration] Test failed:', err.message);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * PUT /integrations/:id
 * Update integration configuration
 * 
 * Body:
 * {
 *   name: "Updated Name",
 *   config: { ... },
 *   syncInterval: 60
 * }
 */
async function updateIntegration(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const userId = req.user._id;
    const { id } = req.params;
    const { name, description, config, syncInterval, syncDirection, status } = req.body;

    const integration = await IntegrationService.updateIntegration(
      id,
      workspace,
      { name, description, config, syncInterval, syncDirection, status },
      userId
    );

    res.json({
      success: true,
      data: integration,
      message: 'Integration updated successfully'
    });
  } catch (err) {
    console.error(`[Integration] Update failed for ${req.user.email}:`, err.message);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * DELETE /integrations/:id
 * Delete integration
 */
async function deleteIntegration(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { id } = req.params;

    const result = await IntegrationService.deleteIntegration(id, workspace);

    res.json({
      success: true,
      message: 'Integration deleted successfully'
    });
  } catch (err) {
    console.error(`[Integration] Delete failed for ${req.user.email}:`, err.message);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /integrations/:id/connect
 * Connect/activate an integration
 */
async function connectIntegration(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const userId = req.user._id;
    const { id } = req.params;

    const integration = await IntegrationService.updateIntegration(
      id,
      workspace,
      { status: 'connected' },
      userId
    );

    res.json({
      success: true,
      data: integration,
      message: 'Integration connected'
    });
  } catch (err) {
    console.error(`[Integration] Connect failed:`, err.message);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST /integrations/:id/disconnect
 * Disconnect/deactivate an integration
 */
async function disconnectIntegration(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const userId = req.user._id;
    const { id } = req.params;

    const integration = await IntegrationService.updateIntegration(
      id,
      workspace,
      { status: 'disconnected' },
      userId
    );

    res.json({
      success: true,
      data: integration,
      message: 'Integration disconnected'
    });
  } catch (err) {
    console.error(`[Integration] Disconnect failed:`, err.message);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * GET /integrations/check/permissions/:type
 * Check if workspace plan allows specific integration type
 */
async function checkPermissions(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { type } = req.params;

    const result = await IntegrationService.canUseIntegrationType(workspace, type);

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * GET /integrations/sync-status
 * Get sync status for all integrations
 */
async function getSyncStatus(req, res, next) {
  try {
    const workspace = req.user.workspace;

    const integrations = await Integration.find({ workspace })
      .select('name type status lastSyncAt nextSyncAt lastError usage')
      .lean();

    const syncStatus = integrations.map((integration) => ({
      id: integration._id,
      name: integration.name,
      type: integration.type,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
      nextSyncAt: integration.nextSyncAt,
      lastError: integration.lastError,
      syncsThisMonth: integration.usage?.syncsThisMonth || 0
    }));

    res.json({
      success: true,
      data: syncStatus,
      count: syncStatus.length
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /integrations/:id/test-connection
 * Test if integration is still working
 */
async function testConnection(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { id } = req.params;

    const integration = await Integration.findOne({
      _id: id,
      workspace
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    const config = integration.getDecryptedConfig();
    const result = await IntegrationService.testIntegration(workspace, integration.type, config);

    res.json({
      success: result.success,
      data: result
    });
  } catch (err) {
    console.error('[Integration] Connection test failed:', err.message);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

module.exports = {
  listIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegration,
  connectIntegration,
  disconnectIntegration,
  checkPermissions,
  getSyncStatus,
  testConnection
};
