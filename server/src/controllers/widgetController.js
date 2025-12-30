/**
 * Widget Controller
 * 
 * HTTP request handlers for widget configuration and embed delivery.
 * Provides REST API for frontend and embed.js delivery for customer websites.
 * 
 * REUSED PATTERNS:
 * - Error handling with user context (from integrationsController)
 * - Input validation (from integrationsController)
 * - Safe JSON responses (from integrationsController)
 */

const widgetService = require('../services/widgetService');

// ============================================================================
// GET WIDGET CONFIG
// ============================================================================

/**
 * @route   GET /api/v1/widget/config
 * @desc    Get widget configuration for workspace
 * @access  Private (JWT)
 * @returns {Object} Widget config (greeting, position, colors, etc.)
 */
const getConfig = async (req, res, next) => {
  try {
    const { workspace } = req.user;

    if (!workspace) {
      return res.status(400).json({
        error: 'Workspace not found in token',
        code: 'WORKSPACE_NOT_FOUND'
      });
    }

    const config = await widgetService.getWidgetConfig(workspace);

    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Get widget config failed', {
      userEmail: req.user?.email,
      workspace: req.user?.workspace,
      error: error.message
    });

    next(error);
  }
};

// ============================================================================
// UPDATE WIDGET CONFIG
// ============================================================================

/**
 * @route   PUT /api/v1/widget/config
 * @desc    Update widget configuration (greeting, colors, behavior, etc.)
 * @access  Private (JWT + admin/owner role required)
 * @body    {
 *            enabled?: boolean,
 *            position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'full-width-bottom',
 *            color?: { primary: string, secondary: string, text: string },
 *            greeting?: { text: string, subtext?: string, enabled: boolean },
 *            defaultMessage?: string,
 *            conversation?: { showHistory: boolean, autoCloseAfter: number, ... },
 *            behavior?: { showByDefault: boolean, buttonLabel: string, ... },
 *            attribution?: { enabled: boolean, customText?: string }
 *          }
 * @returns {Object} Updated widget config
 */
const updateConfig = async (req, res, next) => {
  try {
    const { workspace, email } = req.user;
    const updates = req.body;

    if (!workspace) {
      return res.status(400).json({
        error: 'Workspace not found in token',
        code: 'WORKSPACE_NOT_FOUND'
      });
    }

    // Validate input
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No fields to update',
        code: 'EMPTY_UPDATE'
      });
    }

    // Validate known fields
    const validFields = ['enabled', 'position', 'color', 'greeting', 'defaultMessage',
      'conversation', 'behavior', 'attribution'];
    const unknownFields = Object.keys(updates).filter(k => !validFields.includes(k));

    if (unknownFields.length > 0) {
      return res.status(400).json({
        error: `Unknown fields: ${unknownFields.join(', ')}`,
        code: 'INVALID_FIELDS'
      });
    }

    // Validate enum fields
    if (updates.position && !['bottom-right', 'bottom-left', 'top-right', 'top-left', 'full-width-bottom'].includes(updates.position)) {
      return res.status(400).json({
        error: 'Invalid position value',
        code: 'INVALID_POSITION'
      });
    }

    const config = await widgetService.updateWidgetConfig(workspace, updates, req.user._id);

    console.log('Widget config updated', {
      userEmail: email,
      workspace,
      fieldsUpdated: Object.keys(updates)
    });

    res.status(200).json({
      success: true,
      data: config,
      message: 'Widget configuration updated successfully'
    });
  } catch (error) {
    console.error('Update widget config failed', {
      userEmail: req.user?.email,
      workspace: req.user?.workspace,
      error: error.message
    });

    if (error.message.includes('not available on') || error.message.includes('Validation failed')) {
      return res.status(400).json({
        error: error.message,
        code: 'INVALID_CONFIG'
      });
    }

    next(error);
  }
};

// ============================================================================
// WIDGET STATUS
// ============================================================================

/**
 * @route   POST /api/v1/widget/enable
 * @desc    Enable widget for workspace
 * @access  Private (JWT)
 * @returns {Object} Updated widget config
 */
const enableWidget = async (req, res, next) => {
  try {
    const { workspace, email } = req.user;

    if (!workspace) {
      return res.status(400).json({
        error: 'Workspace not found in token',
        code: 'WORKSPACE_NOT_FOUND'
      });
    }

    const config = await widgetService.setWidgetStatus(workspace, true, req.user._id);

    console.log('Widget enabled', {
      userEmail: email,
      workspace
    });

    res.status(200).json({
      success: true,
      data: config,
      message: 'Widget enabled successfully'
    });
  } catch (error) {
    console.error('Enable widget failed', {
      userEmail: req.user?.email,
      workspace: req.user?.workspace,
      error: error.message
    });

    if (error.message.includes('not available on')) {
      return res.status(403).json({
        error: error.message,
        code: 'PLAN_NOT_SUPPORTED'
      });
    }

    next(error);
  }
};

/**
 * @route   POST /api/v1/widget/disable
 * @desc    Disable widget for workspace
 * @access  Private (JWT)
 * @returns {Object} Updated widget config
 */
const disableWidget = async (req, res, next) => {
  try {
    const { workspace, email } = req.user;

    if (!workspace) {
      return res.status(400).json({
        error: 'Workspace not found in token',
        code: 'WORKSPACE_NOT_FOUND'
      });
    }

    const config = await widgetService.setWidgetStatus(workspace, false, req.user._id);

    console.log('Widget disabled', {
      userEmail: email,
      workspace
    });

    res.status(200).json({
      success: true,
      data: config,
      message: 'Widget disabled successfully'
    });
  } catch (error) {
    console.error('Disable widget failed', {
      userEmail: req.user?.email,
      workspace: req.user?.workspace,
      error: error.message
    });

    next(error);
  }
};

// ============================================================================
// GET EMBED.JS (CUSTOMER WEBSITE)
// ============================================================================

/**
 * @route   GET /api/v1/widget/embed.js
 * @desc    Get embed.js script for customer website
 * @query   workspace - Workspace ID (required for public endpoint)
 * @query   v - Cache version (optional, for CDN invalidation)
 * @access  Public (with workspace ID)
 * @returns {String} JavaScript code (application/javascript)
 */
const getEmbedJs = async (req, res, next) => {
  try {
    const { workspace, v } = req.query;

    if (!workspace) {
      return res.status(400).json({
        error: 'Workspace ID required',
        code: 'MISSING_WORKSPACE'
      });
    }

    // Validate workspace ID format
    if (!/^[0-9a-f]{24}$/i.test(workspace)) {
      return res.status(400).json({
        error: 'Invalid workspace ID format',
        code: 'INVALID_WORKSPACE_ID'
      });
    }

    // Check cache header for CDN/browser caching
    const cacheVersion = v || '1';
    const cacheControl = 'public, max-age=604800'; // 7 days
    res.set('Cache-Control', cacheControl);
    res.set('Content-Type', 'application/javascript');
    res.set('X-Cache-Version', cacheVersion);

    // Get embed script (cached if available)
    const { script, cached, cacheVersion: version } = await widgetService.getEmbedScript(workspace);

    res.set('X-Cache-Version', version);
    res.set('X-From-Cache', cached ? 'true' : 'false');

    res.status(200).send(script);
  } catch (error) {
    console.error('Get embed.js failed', {
      workspace: req.query?.workspace,
      error: error.message
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Widget not found',
        code: 'WIDGET_NOT_FOUND'
      });
    }

    next(error);
  }
};

// ============================================================================
// WIDGET TOKEN (FOR FRONTEND REQUESTS)
// ============================================================================

/**
 * @route   GET /api/v1/widget/token
 * @desc    Get widget token for frontend requests (signed JWT)
 * @access  Private (JWT + workspace context)
 * @returns {Object} { token, expiresIn, workspaceId }
 */
const getWidgetToken = async (req, res, next) => {
  try {
    const { workspace } = req.user;

    if (!workspace) {
      return res.status(400).json({
        error: 'Workspace not found in token',
        code: 'WORKSPACE_NOT_FOUND'
      });
    }

    const tokenData = await widgetService.generateWidgetToken(workspace);

    res.status(200).json({
      success: true,
      data: tokenData
    });
  } catch (error) {
    console.error('Get widget token failed', {
      userEmail: req.user?.email,
      workspace: req.user?.workspace,
      error: error.message
    });

    if (error.message.includes('not enabled')) {
      return res.status(400).json({
        error: 'Widget is not enabled',
        code: 'WIDGET_NOT_ENABLED'
      });
    }

    next(error);
  }
};

// ============================================================================
// WIDGET USAGE & ANALYTICS
// ============================================================================

/**
 * @route   GET /api/v1/widget/usage
 * @desc    Get widget usage statistics
 * @access  Private (JWT)
 * @returns {Object} { sessionsThisMonth, messagesThisMonth, uniqueVisitorsThisMonth, lastActivityAt }
 */
const getUsage = async (req, res, next) => {
  try {
    const { workspace } = req.user;

    if (!workspace) {
      return res.status(400).json({
        error: 'Workspace not found in token',
        code: 'WORKSPACE_NOT_FOUND'
      });
    }

    const usage = await widgetService.getWidgetUsage(workspace);

    res.status(200).json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Get widget usage failed', {
      userEmail: req.user?.email,
      workspace: req.user?.workspace,
      error: error.message
    });

    next(error);
  }
};

// ============================================================================
// WIDGET PERMISSIONS
// ============================================================================

/**
 * @route   GET /api/v1/widget/permissions
 * @desc    Check widget permissions for workspace plan
 * @access  Private (JWT)
 * @returns {Object} { enabled, maxWidgets, customization, reason }
 */
const checkPermissions = async (req, res, next) => {
  try {
    const { workspace } = req.user;

    if (!workspace) {
      return res.status(400).json({
        error: 'Workspace not found in token',
        code: 'WORKSPACE_NOT_FOUND'
      });
    }

    // Get workspace plan
    const Workspace = require('../models/Workspace');
    const ws = await Workspace.findById(workspace);

    if (!ws) {
      return res.status(404).json({
        error: 'Workspace not found',
        code: 'WORKSPACE_NOT_FOUND'
      });
    }

    const permissions = widgetService.canUseWidget(ws.plan);

    res.status(200).json({
      success: true,
      data: {
        plan: ws.plan,
        permissions
      }
    });
  } catch (error) {
    console.error('Check widget permissions failed', {
      userEmail: req.user?.email,
      workspace: req.user?.workspace,
      error: error.message
    });

    next(error);
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Config management
  getConfig,
  updateConfig,

  // Widget status
  enableWidget,
  disableWidget,

  // Public embed
  getEmbedJs,

  // Frontend support
  getWidgetToken,

  // Analytics
  getUsage,

  // Permissions
  checkPermissions
};
