const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widgetController');
const authMiddleware = require('../middlewares/auth');

/**
 * Widget Routes
 * 
 * PRIVATE ROUTES (require JWT auth):
 * - Workspace configuration management
 * - Widget settings and customization
 * - Analytics and usage tracking
 * - Plan permission checks
 * 
 * PUBLIC ROUTES (no auth required):
 * - GET /embed.js - Embed script delivery to customer websites
 */

// ============================================================================
// CONFIGURATION MANAGEMENT (Private - JWT Required)
// ============================================================================

/**
 * @route   GET /api/v1/widget/config
 * @desc    Get widget configuration for workspace
 * @access  Private
 */
router.get('/config', authMiddleware, widgetController.getConfig);

/**
 * @route   PUT /api/v1/widget/config
 * @desc    Update widget configuration
 * @body    { enabled, position, color, greeting, defaultMessage, conversation, behavior, attribution }
 * @access  Private
 */
router.put('/config', authMiddleware, widgetController.updateConfig);

// ============================================================================
// WIDGET STATUS (Private - JWT Required)
// ============================================================================

/**
 * @route   POST /api/v1/widget/enable
 * @desc    Enable widget for workspace
 * @access  Private
 */
router.post('/enable', authMiddleware, widgetController.enableWidget);

/**
 * @route   POST /api/v1/widget/disable
 * @desc    Disable widget for workspace
 * @access  Private
 */
router.post('/disable', authMiddleware, widgetController.disableWidget);

// ============================================================================
// WIDGET ANALYTICS (Private - JWT Required)
// ============================================================================

/**
 * @route   GET /api/v1/widget/usage
 * @desc    Get widget usage statistics
 * @access  Private
 */
router.get('/usage', authMiddleware, widgetController.getUsage);

/**
 * @route   GET /api/v1/widget/token
 * @desc    Get widget token for frontend requests
 * @access  Private
 */
router.get('/token', authMiddleware, widgetController.getWidgetToken);

// ============================================================================
// WIDGET PERMISSIONS (Private - JWT Required)
// ============================================================================

/**
 * @route   GET /api/v1/widget/permissions
 * @desc    Check widget permissions for workspace plan
 * @access  Private
 */
router.get('/permissions', authMiddleware, widgetController.checkPermissions);

// ============================================================================
// EMBED SCRIPT (Public - No Auth)
// ============================================================================

/**
 * @route   GET /api/v1/widget/embed.js
 * @desc    Get embed.js script for customer website
 * @query   workspace - Workspace ID (required)
 * @query   v - Cache version (optional, for CDN invalidation)
 * @access  Public
 * @returns {String} JavaScript (application/javascript)
 * 
 * USAGE ON CUSTOMER WEBSITE:
 * <script src="https://api.wapi.com/api/v1/widget/embed.js?workspace=WORKSPACE_ID"></script>
 * 
 * CACHING:
 * - Server-side: 7-day cache with version tracking
 * - Client-side: Browser cache (Cache-Control: public, max-age=604800)
 * - CDN compatible: Use v= query param to invalidate cache
 */
router.get('/embed.js', widgetController.getEmbedJs);

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = router;
