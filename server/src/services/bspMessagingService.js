/**
 * BSP Messaging Service
 * 
 * Centralized service for all WhatsApp messaging operations in the BSP multi-tenant model.
 * ALL Meta API calls MUST go through this service to ensure:
 * 1. Proper use of the centralized system user token
 * 2. Per-workspace rate limiting
 * 3. Tenant isolation and message logging
 * 4. Consistent error handling
 * 
 * This is the ONLY layer that should make Meta API calls for messaging.
 */

const axios = require('axios');
const crypto = require('crypto');
const bspConfig = require('../config/bspConfig');
const Workspace = require('../models/Workspace');
const Message = require('../models/Message');
const { markTokenInvalid } = require('./bspHealthService');
const { isOptedOutByPhone, isOptedOut } = require('./optOutService');
// Token retrieval is centralized in Parent WABA service
const { getSystemUserToken, getParentWaba } = require('./parentWabaService');
const { getActiveChildBusinessForWorkspace, createOrUpdateChildBusinessFromWorkspace } = require('./childBusinessService');
const { enforceWorkspaceBilling } = require('./billingEnforcementService');
const auditService = require('./auditService');

// In-memory rate limiter (use Redis in production for distributed systems)
const rateLimiters = new Map();

// Single token authority (vault-backed)
let systemTokenCache = null;

async function getSystemToken() {
  if (systemTokenCache) return systemTokenCache;
  systemTokenCache = await getSystemUserToken();
  return systemTokenCache;
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * CORE MESSAGING FUNCTIONS
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Send a text message via WhatsApp Cloud API
 * @param {string} workspaceId - The workspace/tenant ID
 * @param {string} to - Recipient phone number (E.164 format)
 * @param {string} text - Message text
 * @param {Object} options - Additional options
 * @returns {Object} Result with messageId
 */
async function sendTextMessage(workspaceId, to, text, options = {}) {
  // Get workspace and validate BSP configuration
  const workspace = await getWorkspaceForMessaging(workspaceId);

  // Compliance: enforce opt-out across all outbound sends
  // WHY: Meta policy requires honoring STOP universally
  if (options.contactId) {
    const optedOut = await isOptedOut(options.contactId);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  } else {
    const optedOut = await isOptedOutByPhone(workspaceId, to);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  }
  
  // Check rate limits
  await checkRateLimit(workspace);
  
  const phoneNumberId = workspace.getPhoneNumberId();
  if (!phoneNumberId) {
    throw new Error('BSP_PHONE_NOT_CONFIGURED');
  }
  
  const url = `${bspConfig.baseUrl}/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: { body: text }
  };
  
  try {
    const response = await makeMetaApiCall('POST', url, payload);
    
    // Log message for this tenant
    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'text',
      to,
      body: text,
      status: 'sent',
      whatsappMessageId: response.messages?.[0]?.id,
      ...options
    });
    
    // Increment usage
    await workspace.incrementBspMessageUsage();
    
    return {
      success: true,
      messageId: response.messages?.[0]?.id,
      data: response
    };
  } catch (error) {
    // Log failed attempt
    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'text',
      to,
      body: text,
      status: 'failed',
      error: error.message,
      ...options
    });
    
    throw error;
  }
}

/**
 * Send a template message via WhatsApp Cloud API
 * @param {string} workspaceId - The workspace/tenant ID
 * @param {string} to - Recipient phone number
 * @param {string} templateName - Template name (must be approved on parent WABA)
 * @param {string} languageCode - Template language code
 * @param {Array} components - Template components with parameters
 * @param {Object} options - Additional options (contactId, campaignId, etc.)
 * @returns {Object} Result with messageId
 */
async function sendTemplateMessage(workspaceId, to, templateName, languageCode = 'en', components = [], options = {}) {
  const workspace = await getWorkspaceForMessaging(workspaceId);

  // Compliance: enforce opt-out across all outbound sends
  if (options.contactId) {
    const optedOut = await isOptedOut(options.contactId);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  } else {
    const optedOut = await isOptedOutByPhone(workspaceId, to);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  }
  
  await checkRateLimit(workspace);
  
  const phoneNumberId = workspace.getPhoneNumberId();
  if (!phoneNumberId) {
    throw new Error('BSP_PHONE_NOT_CONFIGURED');
  }
  
  const url = `${bspConfig.baseUrl}/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components
    }
  };
  
  try {
    const response = await makeMetaApiCall('POST', url, payload);
    
    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'template',
      to,
      templateName,
      status: 'sent',
      whatsappMessageId: response.messages?.[0]?.id,
      ...options
    });
    
    await workspace.incrementBspMessageUsage();
    
    return {
      success: true,
      messageId: response.messages?.[0]?.id,
      data: response
    };
  } catch (error) {
    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'template',
      to,
      templateName,
      status: 'failed',
      error: error.message,
      ...options
    });
    
    throw error;
  }
}

/**
 * Send a media message (image, video, document, audio)
 * @param {string} workspaceId - The workspace/tenant ID
 * @param {string} to - Recipient phone number
 * @param {string} mediaType - Type: 'image', 'video', 'document', 'audio'
 * @param {Object} media - Media object with id or link
 * @param {string} caption - Optional caption
 * @param {Object} options - Additional options
 */
async function sendMediaMessage(workspaceId, to, mediaType, media, caption = '', options = {}) {
  const workspace = await getWorkspaceForMessaging(workspaceId);

  // Compliance: enforce opt-out across all outbound sends
  if (options.contactId) {
    const optedOut = await isOptedOut(options.contactId);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  } else {
    const optedOut = await isOptedOutByPhone(workspaceId, to);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  }
  
  await checkRateLimit(workspace);
  
  const phoneNumberId = workspace.getPhoneNumberId();
  if (!phoneNumberId) {
    throw new Error('BSP_PHONE_NOT_CONFIGURED');
  }
  
  const url = `${bspConfig.baseUrl}/${phoneNumberId}/messages`;
  
  const mediaPayload = { ...media };
  if (caption && ['image', 'video', 'document'].includes(mediaType)) {
    mediaPayload.caption = caption;
  }
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: mediaType,
    [mediaType]: mediaPayload
  };
  
  try {
    const response = await makeMetaApiCall('POST', url, payload);
    
    await logMessage(workspace._id, {
      direction: 'outbound',
      type: mediaType,
      to,
      body: caption || `[${mediaType}]`,
      status: 'sent',
      whatsappMessageId: response.messages?.[0]?.id,
      meta: { media },
      ...options
    });
    
    await workspace.incrementBspMessageUsage();
    
    return {
      success: true,
      messageId: response.messages?.[0]?.id,
      data: response
    };
  } catch (error) {
    await logMessage(workspace._id, {
      direction: 'outbound',
      type: mediaType,
      to,
      status: 'failed',
      error: error.message,
      ...options
    });
    
    throw error;
  }
}

/**
 * Send an interactive message (buttons, list)
 * @param {string} workspaceId - The workspace/tenant ID
 * @param {string} to - Recipient phone number
 * @param {Object} interactive - Interactive message object
 * @param {Object} options - Additional options
 */
async function sendInteractiveMessage(workspaceId, to, interactive, options = {}) {
  const workspace = await getWorkspaceForMessaging(workspaceId);

  // Compliance: enforce opt-out across all outbound sends
  if (options.contactId) {
    const optedOut = await isOptedOut(options.contactId);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  } else {
    const optedOut = await isOptedOutByPhone(workspaceId, to);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  }
  
  await checkRateLimit(workspace);
  
  const phoneNumberId = workspace.getPhoneNumberId();
  if (!phoneNumberId) {
    throw new Error('BSP_PHONE_NOT_CONFIGURED');
  }
  
  const url = `${bspConfig.baseUrl}/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'interactive',
    interactive: interactive
  };
  
  try {
    const response = await makeMetaApiCall('POST', url, payload);
    
    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'interactive',
      to,
      body: interactive.body?.text || '[Interactive]',
      status: 'sent',
      whatsappMessageId: response.messages?.[0]?.id,
      meta: { interactive },
      ...options
    });
    
    await workspace.incrementBspMessageUsage();
    
    return {
      success: true,
      messageId: response.messages?.[0]?.id,
      data: response
    };
  } catch (error) {
    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'interactive',
      to,
      status: 'failed',
      error: error.message,
      ...options
    });
    
    throw error;
  }
}

/**
 * Mark a message as read
 * @param {string} workspaceId - The workspace/tenant ID
 * @param {string} messageId - WhatsApp message ID to mark as read
 */
async function markAsRead(workspaceId, messageId) {
  const workspace = await getWorkspaceForMessaging(workspaceId);
  
  const phoneNumberId = workspace.getPhoneNumberId();
  if (!phoneNumberId) {
    throw new Error('BSP_PHONE_NOT_CONFIGURED');
  }
  
  const url = `${bspConfig.baseUrl}/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId
  };
  
  try {
    const response = await makeMetaApiCall('POST', url, payload);
    return { success: true, data: response };
  } catch (error) {
    console.error(`[BSP] Failed to mark message as read: ${error.message}`);
    throw error;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * TEMPLATE MANAGEMENT (Parent WABA Level)
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Submit a template to Meta for approval
 * Templates are submitted under the PARENT WABA but tracked per workspace
 * @param {string} workspaceId - The workspace submitting the template
 * @param {Object} templateData - Template data
 */
async function submitTemplate(workspaceId, templateData) {
  const workspace = await getWorkspaceForMessaging(workspaceId);
  
  // Check template submission rate limit
  await checkTemplateSubmissionLimit(workspace);
  
  const wabaId = bspConfig.parentWabaId;
  const url = `${bspConfig.baseUrl}/${wabaId}/message_templates`;
  
  // Ensure template name is unique by prefixing with workspace identifier
  // This follows Interakt's model of namespace isolation
  const namespacedName = `${workspace._id.toString().slice(-8)}_${templateData.name}`;
  
  const payload = {
    name: namespacedName,
    language: templateData.language || 'en',
    category: templateData.category || 'MARKETING',
    components: templateData.components || []
  };
  
  try {
    const response = await makeMetaApiCall('POST', url, payload);
    
    // Increment template submission counter
    await Workspace.findByIdAndUpdate(workspace._id, {
      $inc: { 'bspUsage.templateSubmissionsToday': 1 }
    });
    
    return {
      success: true,
      templateId: response.id,
      status: response.status,
      namespacedName,
      data: response
    };
  } catch (error) {
    console.error(`[BSP] Template submission failed: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch templates from parent WABA
 * @param {Object} options - Fetch options (limit, after cursor)
 */
async function fetchTemplates(options = {}) {
  const wabaId = bspConfig.parentWabaId;
  const url = `${bspConfig.baseUrl}/${wabaId}/message_templates`;
  
  const params = {
    limit: options.limit || 100,
    fields: 'name,language,status,category,components,rejected_reason,quality_score'
  };
  
  if (options.after) {
    params.after = options.after;
  }
  
  try {
    const response = await makeMetaApiCall('GET', url, null, params);
    return {
      success: true,
      templates: response.data || [],
      paging: response.paging
    };
  } catch (error) {
    console.error(`[BSP] Failed to fetch templates: ${error.message}`);
    throw error;
  }
}

/**
 * Delete a template from parent WABA
 * @param {string} templateName - Template name to delete
 */
async function deleteTemplate(templateName) {
  const wabaId = bspConfig.parentWabaId;
  const url = `${bspConfig.baseUrl}/${wabaId}/message_templates`;
  
  try {
    const response = await makeMetaApiCall('DELETE', url, null, { name: templateName });
    return { success: true, data: response };
  } catch (error) {
    console.error(`[BSP] Failed to delete template: ${error.message}`);
    throw error;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * PHONE NUMBER MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Get phone number details from Meta
 * @param {string} phoneNumberId - The phone number ID
 */
async function getPhoneNumberDetails(phoneNumberId) {
  const url = `${bspConfig.baseUrl}/${phoneNumberId}`;
  
  const params = {
    fields: 'verified_name,code_verification_status,display_phone_number,quality_rating,status,messaging_limit_tier,is_official_business_account,name_status'
  };
  
  try {
    const response = await makeMetaApiCall('GET', url, null, params);
    return {
      success: true,
      phoneNumber: response
    };
  } catch (error) {
    console.error(`[BSP] Failed to get phone number details: ${error.message}`);
    throw error;
  }
}

/**
 * Update business profile for a phone number
 * @param {string} workspaceId - The workspace ID
 * @param {Object} profileData - Business profile data
 */
async function updateBusinessProfile(workspaceId, profileData) {
  const workspace = await getWorkspaceForMessaging(workspaceId);
  
  const phoneNumberId = workspace.getPhoneNumberId();
  if (!phoneNumberId) {
    throw new Error('BSP_PHONE_NOT_CONFIGURED');
  }
  
  const url = `${bspConfig.baseUrl}/${phoneNumberId}/whatsapp_business_profile`;
  
  try {
    const response = await makeMetaApiCall('POST', url, profileData);
    return { success: true, data: response };
  } catch (error) {
    console.error(`[BSP] Failed to update business profile: ${error.message}`);
    throw error;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * MEDIA HANDLING
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Upload media to Meta for a specific phone number
 * @param {string} workspaceId - The workspace ID
 * @param {Buffer|Stream} file - File to upload
 * @param {string} mimeType - MIME type of the file
 */
async function uploadMedia(workspaceId, file, mimeType) {
  const workspace = await getWorkspaceForMessaging(workspaceId);
  
  const phoneNumberId = workspace.getPhoneNumberId();
  if (!phoneNumberId) {
    throw new Error('BSP_PHONE_NOT_CONFIGURED');
  }
  
  const url = `${bspConfig.baseUrl}/${phoneNumberId}/media`;
  
  const FormData = require('form-data');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('messaging_product', 'whatsapp');
  formData.append('type', mimeType);
  
  try {
    const systemToken = await getSystemToken();
    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${systemToken}`
      }
    });
    
    return {
      success: true,
      mediaId: response.data.id
    };
  } catch (error) {
    console.error(`[BSP] Media upload failed: ${error.message}`);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Get media URL for downloading
 * @param {string} mediaId - The media ID from WhatsApp
 */
async function getMediaUrl(mediaId) {
  const url = `${bspConfig.baseUrl}/${mediaId}`;
  
  try {
    const response = await makeMetaApiCall('GET', url);
    return {
      success: true,
      url: response.url,
      mimeType: response.mime_type,
      sha256: response.sha256,
      fileSize: response.file_size
    };
  } catch (error) {
    console.error(`[BSP] Failed to get media URL: ${error.message}`);
    throw error;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * WEBHOOK VERIFICATION
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Verify webhook signature from Meta
 * @param {string} requestBody - Raw request body string
 * @param {string} signatureHeader - X-Hub-Signature-256 header value
 */
function verifyWebhookSignature(requestBody, signatureHeader) {
  if (!signatureHeader || !bspConfig.appSecret) {
    return false;
  }
  
  const signatureParts = signatureHeader.split('=');
  if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
    return false;
  }
  
  const signature = signatureParts[1];
  const expectedSignature = crypto
    .createHmac('sha256', bspConfig.appSecret)
    .update(requestBody)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8')
    );
  } catch {
    return false;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * INTERNAL HELPERS
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Make an authenticated Meta API call using the BSP system token
 */
async function makeMetaApiCall(method, url, data = null, params = null) {
  const systemToken = await getSystemToken();
  
  const config = {
    method,
    url,
    headers: {
      'Authorization': `Bearer ${systemToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    config.data = data;
  }
  
  if (params) {
    config.params = params;
  }
  
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    const metaError = error.response?.data?.error;
    
    // Handle specific Meta errors
    if (error.response?.status === 401 || metaError?.code === 190) {
      console.error('[BSP] ⚠️ System user token expired or invalid!');
      // Update BSP health snapshot (no token exposure)
      markTokenInvalid(metaError?.message || 'System token invalid').catch(() => null);
      throw new Error('BSP_TOKEN_EXPIRED');
    }
    
    if (metaError?.code === 131056) {
      throw new Error('BSP_RATE_LIMITED');
    }
    
    if (metaError?.code === 131051) {
      throw new Error('BSP_INVALID_PHONE_NUMBER');
    }
    
    if (metaError?.code === 130472) {
      throw new Error('BSP_USER_NOT_OPTED_IN');
    }
    
    throw new Error(metaError?.message || error.message);
  }
}

/**
 * Get workspace with validation for messaging
 */
async function getWorkspaceForMessaging(workspaceId) {
  const workspace = await Workspace.findById(workspaceId);
  
  if (!workspace) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }
  
  if (!workspace.bspManaged) {
    throw new Error('WORKSPACE_NOT_BSP_MANAGED');
  }

  // Enforce Parent WABA ownership + child asset attachment
  let childBusiness = await getActiveChildBusinessForWorkspace(workspaceId).catch(async (err) => {
    // Attempt a one-time backfill for legacy workspaces
    const migrated = await createOrUpdateChildBusinessFromWorkspace(workspace);
    if (migrated && migrated.phoneStatus === 'active') return migrated;
    throw err;
  });

  const parent = await getParentWaba();
  if (!parent || childBusiness.parentWabaId !== parent.wabaId) {
    throw new Error('PARENT_WABA_MISMATCH');
  }

  // Attach child business for downstream access
  workspace._childBusiness = childBusiness;
  
  if (!workspace.canSendMessage()) {
    throw new Error('BSP_MESSAGING_BLOCKED');
  }

  if (process.env.BSP_GLOBAL_MESSAGING_DISABLED === 'true') {
    throw new Error('BSP_GLOBAL_MESSAGING_DISABLED');
  }

  await enforceWorkspaceBilling(workspace._id);
  
  return workspace;
}

/**
 * Check rate limit for workspace
 */
async function checkRateLimit(workspace) {
  const plan = workspace.plan || 'free';
  const workspaceId = workspace._id.toString();

  const qualityRating = workspace._childBusiness?.qualityRating || workspace.bspQualityRating || workspace.qualityRating;
  const qualityThrottle = qualityRating === 'YELLOW' ? 0.5 : 1;

  // Interakt-style safety: throttle on low quality to avoid enforcement
  const throttled = (limit) => Math.max(1, Math.floor(limit * qualityThrottle));
  
  // Get configured limits
  const maxMessagesPerSecond = throttled(
    workspace.bspRateLimits?.messagesPerSecond || bspConfig.getRateLimit(plan, 'messagesPerSecond')
  );
  const maxDailyMessages = throttled(
    workspace.bspRateLimits?.dailyMessageLimit || bspConfig.getRateLimit(plan, 'dailyMessageLimit')
  );
  const maxMonthlyMessages = throttled(
    workspace.bspRateLimits?.monthlyMessageLimit || bspConfig.getRateLimit(plan, 'monthlyMessageLimit')
  );
  
  // Check per-second rate limit (sliding window)
  const now = Date.now();
  const windowKey = `${workspaceId}:msgs`;
  
  if (!rateLimiters.has(windowKey)) {
    rateLimiters.set(windowKey, { count: 0, windowStart: now });
  }
  
  const limiter = rateLimiters.get(windowKey);
  
  // Reset window if more than 1 second has passed
  if (now - limiter.windowStart > 1000) {
    limiter.count = 0;
    limiter.windowStart = now;
  }
  
  limiter.count++;
  
  if (limiter.count > maxMessagesPerSecond) {
    throw new Error(`BSP_RATE_LIMIT_EXCEEDED: Max ${maxMessagesPerSecond} messages/second for ${plan} plan`);
  }
  
  // Check daily limit
  const dailyUsage = workspace.bspUsage?.messagesToday || 0;
  if (dailyUsage >= maxDailyMessages) {
    throw new Error(`BSP_DAILY_LIMIT_EXCEEDED: Max ${maxDailyMessages} messages/day for ${plan} plan`);
  }
  
  // Check monthly limit
  const monthlyUsage = workspace.bspUsage?.messagesThisMonth || 0;
  if (monthlyUsage >= maxMonthlyMessages) {
    throw new Error(`BSP_MONTHLY_LIMIT_EXCEEDED: Max ${maxMonthlyMessages} messages/month for ${plan} plan`);
  }
}

/**
 * Check template submission rate limit
 */
async function checkTemplateSubmissionLimit(workspace) {
  const plan = workspace.plan || 'free';
  const maxSubmissions = workspace.bspRateLimits?.templateSubmissionsPerDay ||
    bspConfig.getRateLimit(plan, 'templateSubmissionsPerDay');
  
  const todaySubmissions = workspace.bspUsage?.templateSubmissionsToday || 0;
  
  if (todaySubmissions >= maxSubmissions) {
    throw new Error(`BSP_TEMPLATE_LIMIT_EXCEEDED: Max ${maxSubmissions} template submissions/day for ${plan} plan`);
  }
}

/**
 * Log message for audit trail
 */
async function logMessage(workspaceId, messageData) {
  try {
    const message = await Message.create({
      workspace: workspaceId,
      contact: messageData.contactId,
      conversation: messageData.conversationId || undefined,
      sentBy: messageData.sentBy || undefined,
      direction: messageData.direction,
      type: messageData.type,
      body: messageData.body,
      status: messageData.status,
      sentAt: messageData.status === 'sent' ? new Date() : null,
      meta: {
        whatsappId: messageData.whatsappMessageId,
        templateName: messageData.templateName,
        campaignId: messageData.campaignId,
        error: messageData.error,
        bspLogged: true,
        ...messageData.meta
      }
    });

    auditService.log(
      workspaceId,
      messageData.sentBy || null,
      messageData.status === 'sent' ? 'message.outbound.sent' : 'message.outbound.failed',
      { type: 'message', id: message._id },
      {
        templateName: messageData.templateName,
        campaignId: messageData.campaignId,
        error: messageData.error || null
      }
    );
    return message;
  } catch (err) {
    console.error('[BSP] Failed to log message:', err.message);
    // Don't throw - logging should not block sending
    return null;
  }
}

// Periodic cleanup of rate limiter memory
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimiters.entries()) {
    if (now - data.windowStart > 60000) {
      rateLimiters.delete(key);
    }
  }
}, 60000);

module.exports = {
  // Messaging
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  sendInteractiveMessage,
  markAsRead,
  
  // Templates
  submitTemplate,
  fetchTemplates,
  deleteTemplate,
  
  // Phone management
  getPhoneNumberDetails,
  updateBusinessProfile,
  
  // Media
  uploadMedia,
  getMediaUrl,
  
  // Webhook
  verifyWebhookSignature,
  
  // Internal (for advanced use)
  makeMetaApiCall,
  getWorkspaceForMessaging,
  checkRateLimit,
  checkTemplateSubmissionLimit
};
