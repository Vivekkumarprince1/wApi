/**
 * Widget Service
 * 
 * Business logic for widget configuration and embed.js generation.
 * Handles plan-based access control, caching, and secure embed delivery.
 * 
 * REUSED PATTERNS:
 * - Plan permission logic (from IntegrationService)
 * - Error handling with context (from IntegrationService)
 * - Config validation (from IntegrationService)
 */

const WidgetConfig = require('../models/WidgetConfig');
const Workspace = require('../models/Workspace');
const crypto = require('crypto');

// ============================================================================
// PLAN PERMISSIONS
// ============================================================================

const PLAN_PERMISSIONS = {
  free: {
    enabled: false,
    reason: 'Widget requires Basic plan or higher'
  },
  basic: {
    enabled: true,
    maxWidgets: 1,
    customization: {
      colors: false,
      greeting: true,
      behavior: false
    }
  },
  premium: {
    enabled: true,
    maxWidgets: 5,
    customization: {
      colors: true,
      greeting: true,
      behavior: true
    }
  },
  enterprise: {
    enabled: true,
    maxWidgets: null, // Unlimited
    customization: {
      colors: true,
      greeting: true,
      behavior: true,
      analytics: true
    }
  }
};

// ============================================================================
// GET WIDGET CONFIG
// ============================================================================

/**
 * Get widget configuration for workspace
 * Returns cached embed.js if available
 */
const getWidgetConfig = async (workspaceId, includeCache = false) => {
  try {
    let config = await WidgetConfig.findOne({ workspace: workspaceId });

    if (!config) {
      // Auto-create if doesn't exist
      config = new WidgetConfig({
        workspace: workspaceId,
        enabled: false
      });
      await config.save();
    }

    // Check if cache is valid (less than 7 days old)
    const isCacheValid = config.embed?.cachedAt && 
      (Date.now() - config.embed.cachedAt.getTime()) < 7 * 24 * 60 * 60 * 1000;

    // Return safe JSON, optionally with cache
    const response = config.toSafeJSON();
    
    if (includeCache && isCacheValid) {
      response.embedScript = config.embed.cachedScript;
      response.cacheVersion = config.embed.cacheVersion;
    }

    return response;
  } catch (error) {
    throw new Error(`Failed to fetch widget configuration: ${error.message}`);
  }
};

// ============================================================================
// UPDATE WIDGET CONFIG
// ============================================================================

/**
 * Update widget configuration
 * Validates plan permissions and config
 */
const updateWidgetConfig = async (workspaceId, updates, userId) => {
  try {
    // Check permissions
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const permission = PLAN_PERMISSIONS[workspace.plan];
    if (!permission?.enabled) {
      throw new Error(`Widget not available on ${workspace.plan} plan`);
    }

    // Get or create config
    let config = await WidgetConfig.findOne({ workspace: workspaceId });
    if (!config) {
      config = new WidgetConfig({ workspace: workspaceId });
    }

    // Enforce customization limits based on plan
    if (updates.color && !permission.customization.colors) {
      throw new Error('Color customization not available on your plan');
    }
    if (updates.behavior && !permission.customization.behavior) {
      throw new Error('Behavior customization not available on your plan');
    }

    // Update allowed fields
    const allowedFields = [
      'enabled', 'position', 'color', 'greeting', 'defaultMessage',
      'conversation', 'behavior', 'attribution'
    ];

    for (const field of allowedFields) {
      if (field in updates) {
        if (field === 'color') {
          // Deep merge color object
          config.color = { ...config.color, ...updates.color };
        } else if (['greeting', 'conversation', 'behavior', 'attribution'].includes(field)) {
          // Deep merge objects
          config[field] = { ...config[field], ...updates[field] };
        } else {
          config[field] = updates[field];
        }
      }
    }

    // Validate configuration
    const validation = config.validateConfig();
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Update audit trail
    config.updatedBy = userId;
    config.updatedAt = new Date();

    // Clear cache on config change
    if (updates.position || updates.color || updates.greeting || updates.behavior) {
      await config.clearCache();
    }

    await config.save();

    return config.toSafeJSON();
  } catch (error) {
    throw error;
  }
};

// ============================================================================
// EMBED.JS GENERATION & CACHING
// ============================================================================

/**
 * Generate widget embed.js script
 * Creates a minimal, embeddable script that loads widget on customer website
 */
const generateEmbedScript = async (workspaceId) => {
  try {
    const config = await WidgetConfig.findOne({ workspace: workspaceId });
    if (!config) {
      throw new Error('Widget config not found');
    }

    // Build embed script with workspace context
    const embedScript = `
(function() {
  // Prevent multiple loads
  if (window.__wapiWidget) return;
  window.__wapiWidget = true;

  const CONFIG = {
    workspaceId: '${workspaceId}',
    apiUrl: '${process.env.API_URL || 'https://api.wapi.com/api/v1'}',
    widgetUrl: '${process.env.WIDGET_URL || 'https://widget.wapi.com'}',
    enabled: ${config.enabled},
    position: '${config.position}',
    color: {
      primary: '${config.color.primary}',
      secondary: '${config.color.secondary}',
      text: '${config.color.text}'
    },
    greeting: {
      text: '${this._escapeString(config.greeting.text)}',
      subtext: '${this._escapeString(config.greeting.subtext || '')}',
      enabled: ${config.greeting.enabled}
    },
    defaultMessage: '${this._escapeString(config.defaultMessage)}',
    conversation: {
      showHistory: ${config.conversation.showHistory},
      autoCloseAfter: ${config.conversation.autoCloseAfter},
      collectName: ${config.conversation.collectName},
      collectEmail: ${config.conversation.collectEmail},
      collectPhoneNumber: ${config.conversation.collectPhoneNumber}
    },
    behavior: {
      showByDefault: ${config.behavior.showByDefault},
      buttonLabel: '${this._escapeString(config.behavior.buttonLabel)}',
      delayBeforeShow: ${config.behavior.delayBeforeShow}
    },
    attribution: {
      enabled: ${config.attribution.enabled},
      customText: '${this._escapeString(config.attribution.customText || '')}'
    }
  };

  // Load widget stylesheet
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = CONFIG.widgetUrl + '/widget.css?v=${config.embed.cacheVersion}';
  document.head.appendChild(style);

  // Create widget container
  const container = document.createElement('div');
  container.id = 'wapi-widget-root';
  document.body.appendChild(container);

  // Load widget script
  const script = document.createElement('script');
  script.src = CONFIG.widgetUrl + '/widget.js?v=${config.embed.cacheVersion}';
  script.async = true;
  script.onload = function() {
    if (window.WapiWidget) {
      window.WapiWidget.init(CONFIG);
    }
  };
  document.body.appendChild(script);

  // Track embed load
  fetch(CONFIG.apiUrl + '/widgets/event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-ID': CONFIG.workspaceId
    },
    body: JSON.stringify({
      event: 'embed_loaded',
      url: window.location.href,
      timestamp: new Date().toISOString()
    })
  }).catch(e => console.error('Widget tracking failed:', e));
})();
`.trim();

    // Minify (basic minification)
    const minified = this._minifyScript(embedScript);

    return minified;
  } catch (error) {
    throw error;
  }
};

/**
 * Get or regenerate cached embed.js
 */
const getEmbedScript = async (workspaceId, forceRefresh = false) => {
  try {
    const config = await WidgetConfig.findOne({ workspace: workspaceId });
    if (!config) {
      throw new Error('Widget config not found');
    }

    // Check if cache is valid
    const isCacheValid = !forceRefresh &&
      config.embed?.cachedScript &&
      config.embed?.cachedAt &&
      (Date.now() - config.embed.cachedAt.getTime()) < 7 * 24 * 60 * 60 * 1000;

    if (isCacheValid) {
      return {
        script: config.embed.cachedScript,
        cached: true,
        cacheVersion: config.embed.cacheVersion
      };
    }

    // Generate new script
    const script = await generateEmbedScript(workspaceId);

    // Cache it
    config.embed.cachedScript = script;
    config.embed.cachedAt = new Date();
    config.embed.cacheVersion = (config.embed.cacheVersion || 0) + 1;
    await config.save();

    return {
      script,
      cached: false,
      cacheVersion: config.embed.cacheVersion
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Verify widget token (prevents unauthorized access)
 * Used when widget makes API calls from frontend
 */
const generateWidgetToken = async (workspaceId) => {
  try {
    const config = await WidgetConfig.findOne({ workspace: workspaceId });
    if (!config || !config.enabled) {
      throw new Error('Widget not enabled');
    }

    // Create signed token
    const payload = {
      workspaceId,
      type: 'widget',
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };

    const token = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'secret')
      .update(JSON.stringify(payload))
      .digest('hex');

    return {
      token,
      expiresIn: 24 * 60 * 60,
      workspaceId
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Enable/disable widget
 */
const setWidgetStatus = async (workspaceId, enabled, userId) => {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const permission = PLAN_PERMISSIONS[workspace.plan];
    if (!permission?.enabled && enabled) {
      throw new Error(`Widget not available on ${workspace.plan} plan`);
    }

    let config = await WidgetConfig.findOne({ workspace: workspaceId });
    if (!config) {
      config = new WidgetConfig({ workspace: workspaceId });
    }

    config.enabled = enabled;
    config.updatedBy = userId;
    config.updatedAt = new Date();

    // Clear cache on enable/disable
    if (enabled !== config.enabled) {
      await config.clearCache();
    }

    await config.save();

    return config.toSafeJSON();
  } catch (error) {
    throw error;
  }
};

/**
 * Get widget usage stats
 */
const getWidgetUsage = async (workspaceId) => {
  try {
    const config = await WidgetConfig.findOne({ workspace: workspaceId });
    if (!config) {
      throw new Error('Widget config not found');
    }

    return {
      sessionsThisMonth: config.usage.sessionsThisMonth,
      messagesThisMonth: config.usage.messagesThisMonth,
      uniqueVisitorsThisMonth: config.usage.uniqueVisitorsThisMonth,
      lastActivityAt: config.usage.lastActivityAt
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Check plan permissions
 */
const canUseWidget = (plan) => {
  return PLAN_PERMISSIONS[plan];
};

// ============================================================================
// HELPER METHODS
// ============================================================================

/**
 * Escape strings for JavaScript output
 */
const _escapeString = (str) => {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
};

/**
 * Basic script minification (remove comments, whitespace)
 */
const _minifyScript = (script) => {
  return script
    // Remove comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}();,:])\s*/g, '$1')
    .trim();
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Config management
  getWidgetConfig,
  updateWidgetConfig,
  setWidgetStatus,

  // Embed script
  generateEmbedScript,
  getEmbedScript,
  generateWidgetToken,

  // Analytics
  getWidgetUsage,

  // Permissions
  canUseWidget,
  PLAN_PERMISSIONS,

  // Helpers (for testing)
  _escapeString,
  _minifyScript
};
