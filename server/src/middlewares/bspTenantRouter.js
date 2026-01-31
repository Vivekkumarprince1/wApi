/**
 * BSP Tenant Routing Middleware
 * 
 * This middleware handles routing incoming webhooks to the correct workspace/tenant
 * based on the phone_number_id. It also provides tenant isolation for API requests.
 * 
 * Like Interakt, all webhooks come to a single endpoint but are routed to the
 * correct tenant based on the phone_number_id in the webhook payload.
 */

const Workspace = require('../models/Workspace');
const bspConfig = require('../config/bspConfig');

/**
 * Cache for phone_number_id to workspace mappings
 * Significantly reduces DB lookups for high-volume webhook traffic
 */
const phoneToWorkspaceCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get workspace from cache or database by phone_number_id
 */
async function getWorkspaceByPhoneId(phoneNumberId) {
  if (!phoneNumberId) return null;
  
  // Check cache first
  const cached = phoneToWorkspaceCache.get(phoneNumberId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.workspace;
  }
  
  // Lookup in database
  const workspace = await Workspace.findByPhoneNumberId(phoneNumberId);
  
  // Cache the result (even if null to prevent repeated lookups)
  phoneToWorkspaceCache.set(phoneNumberId, {
    workspace,
    timestamp: Date.now()
  });
  
  return workspace;
}

/**
 * Invalidate cache for a specific phone_number_id
 */
function invalidatePhoneCache(phoneNumberId) {
  phoneToWorkspaceCache.delete(phoneNumberId);
}

/**
 * Clear entire cache (call on workspace updates)
 */
function clearPhoneCache() {
  phoneToWorkspaceCache.clear();
}

/**
 * Extract phone_number_id from webhook payload
 * Handles various Meta webhook formats
 */
function extractPhoneNumberId(body) {
  try {
    // Standard WhatsApp message/status webhook
    if (body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id) {
      return body.entry[0].changes[0].value.metadata.phone_number_id;
    }
    
    // Account update webhook
    if (body.entry?.[0]?.changes?.[0]?.value?.waba_info?.phone_number_id) {
      return body.entry[0].changes[0].value.waba_info.phone_number_id;
    }
    
    // Template status update
    if (body.entry?.[0]?.changes?.[0]?.value?.message_template_id) {
      // Template updates don't include phone_number_id directly
      // We'll need to lookup by template name prefix
      return null;
    }
    
    // Fallback: try to find phone_number_id anywhere in the payload
    const findPhoneId = (obj) => {
      if (!obj || typeof obj !== 'object') return null;
      if (obj.phone_number_id) return obj.phone_number_id;
      for (const value of Object.values(obj)) {
        const found = findPhoneId(value);
        if (found) return found;
      }
      return null;
    };
    
    return findPhoneId(body);
  } catch (err) {
    console.error('[BSP Router] Error extracting phone_number_id:', err.message);
    return null;
  }
}

/**
 * Middleware to route webhooks to the correct tenant
 * This should be applied BEFORE the webhook handler
 */
async function webhookTenantRouter(req, res, next) {
  try {
    const phoneNumberId = extractPhoneNumberId(req.body);
    
    if (!phoneNumberId) {
      // Some webhooks (like template status) may not have phone_number_id
      // Log and continue - the handler will deal with it
      console.log('[BSP Router] No phone_number_id in webhook payload');
      req.bspWorkspace = null;
      req.bspPhoneNumberId = null;
      return next();
    }
    
    // Get workspace for this phone number
    const workspace = await getWorkspaceByPhoneId(phoneNumberId);
    
    if (!workspace) {
      console.warn(`[BSP Router] ⚠️ No workspace found for phone_number_id: ${phoneNumberId}`);
      
      // Log cross-tenant/unknown attempts if configured
      if (bspConfig.logCrossTenantAttempts) {
        console.warn('[BSP Router] Potential orphaned webhook or attack attempt');
      }
      
      // Still allow the webhook through - it might be a new phone being onboarded
      req.bspWorkspace = null;
      req.bspPhoneNumberId = phoneNumberId;
      return next();
    }
    
    // Attach workspace to request for downstream handlers
    req.bspWorkspace = workspace;
    req.bspWorkspaceId = workspace._id;
    req.bspPhoneNumberId = phoneNumberId;
    
    // Log for debugging
    console.log(`[BSP Router] Routed webhook to workspace: ${workspace.name} (${workspace._id})`);
    
    next();
  } catch (err) {
    console.error('[BSP Router] Error routing webhook:', err.message);
    // Don't fail the webhook - respond 200 to Meta but log the error
    next();
  }
}

/**
 * Middleware to enforce BSP tenant isolation on API requests
 * Ensures users can only access their own workspace's data
 */
function enforceTenantIsolation(req, res, next) {
  try {
    // Skip for non-authenticated requests
    if (!req.user || !req.user.workspace) {
      return next();
    }
    
    const userWorkspaceId = req.user.workspace.toString();
    
    // Check if request includes a workspace parameter that doesn't match
    const requestedWorkspaceId = req.params.workspaceId || 
                    req.body.workspaceId || 
                    req.body.workspace ||
                    req.query.workspaceId;
    
    if (requestedWorkspaceId && requestedWorkspaceId !== userWorkspaceId) {
      console.warn(`[BSP Isolation] ⚠️ Cross-tenant access attempt! User workspace: ${userWorkspaceId}, Requested: ${requestedWorkspaceId}`);
      
      if (bspConfig.logCrossTenantAttempts) {
        // Log audit trail
        const AuditLog = require('../models/AuditLog');
        AuditLog.create({
          workspace: userWorkspaceId,
          user: req.user._id,
          action: 'cross_tenant_access_attempt',
          details: {
            requestedWorkspace: requestedWorkspaceId,
            endpoint: req.originalUrl,
            method: req.method
          }
        }).catch(err => console.error('Audit log error:', err));
      }
      
      return res.status(403).json({
        success: false,
        message: 'Access denied: Cannot access resources from another workspace',
        code: 'CROSS_TENANT_ACCESS_DENIED'
      });
    }
    
    // Ensure workspace scope is applied
    req.workspaceScope = userWorkspaceId;
    
    next();
  } catch (err) {
    console.error('[BSP Isolation] Error:', err.message);
    next(err);
  }
}

/**
 * Middleware to validate BSP configuration for messaging routes
 */
async function validateBspConfig(req, res, next) {
  try {
    const validation = bspConfig.validate();
    
    if (!validation.valid) {
      console.error('[BSP Config] Invalid configuration:', validation.errors);
      return res.status(503).json({
        success: false,
        message: 'WhatsApp service is not configured properly',
        code: 'BSP_CONFIG_INVALID',
        errors: validation.errors
      });
    }
    
    next();
  } catch (err) {
    console.error('[BSP Config] Validation error:', err.message);
    next(err);
  }
}

/**
 * Middleware to check if workspace is BSP connected
 */
async function requireBspConnection(req, res, next) {
  try {
    if (!req.user || !req.user.workspace) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const workspace = await Workspace.findById(req.user.workspace);
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
        code: 'WORKSPACE_NOT_FOUND'
      });
    }
    
    if (!workspace.bspManaged) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is not configured for WhatsApp. Please complete onboarding.',
        code: 'BSP_NOT_CONFIGURED',
        requiresOnboarding: true
      });
    }
    
    if (!workspace.bspPhoneNumberId) {
      return res.status(400).json({
        success: false,
        message: 'No WhatsApp phone number assigned to this workspace. Please contact support.',
        code: 'BSP_PHONE_NOT_ASSIGNED'
      });
    }
    
    if (workspace.bspPhoneStatus === 'BANNED') {
      return res.status(403).json({
        success: false,
        message: 'Your WhatsApp number has been banned. Please contact support.',
        code: 'BSP_PHONE_BANNED'
      });
    }
    
    if (workspace.bspPhoneStatus === 'DISCONNECTED') {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp connection lost. Please reconnect.',
        code: 'BSP_DISCONNECTED'
      });
    }
    
    // Attach BSP workspace to request
    req.bspWorkspace = workspace;
    
    next();
  } catch (err) {
    console.error('[BSP Connection] Error:', err.message);
    next(err);
  }
}

/**
 * Route template webhooks to correct workspace
 * Template webhooks don't include phone_number_id, so we route by template name prefix
 */
async function routeTemplateWebhook(templateName) {
  if (!templateName) return null;
  
  // Extract workspace ID from namespaced template name
  // Format: {workspaceIdSuffix}_{templateName}
  const parts = templateName.split('_');
  if (parts.length < 2) return null;
  
  const workspaceIdSuffix = parts[0];
  
  // Find workspace with matching ID suffix
  const workspaces = await Workspace.find({
    bspManaged: true
  }).select('_id name');
  
  for (const ws of workspaces) {
    if (ws._id.toString().slice(-8) === workspaceIdSuffix) {
      return ws;
    }
  }
  
  return null;
}

// Periodic cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of phoneToWorkspaceCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      phoneToWorkspaceCache.delete(key);
    }
  }
}, CACHE_TTL);

module.exports = {
  webhookTenantRouter,
  enforceTenantIsolation,
  validateBspConfig,
  requireBspConnection,
  
  // Helpers
  getWorkspaceByPhoneId,
  extractPhoneNumberId,
  routeTemplateWebhook,
  invalidatePhoneCache,
  clearPhoneCache
};
