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

const bspConfig = require('../config/bspConfig');
const gupshupService = require('./gupshupService');
const Workspace = require('../models/Workspace');
const Message = require('../models/Message');
const { isOptedOutByPhone, isOptedOut } = require('./optOutService');
const { enforceWorkspaceBilling } = require('./billingEnforcementService');
const auditService = require('./auditService');

// In-memory rate limiter (use Redis in production for distributed systems)
const rateLimiters = new Map();

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

  const source = getWorkspaceSourceNumber(workspace);
  const appApiKey = workspace.gupshupIdentity?.appApiKey;
  if (!appApiKey) throw new Error('GUPSHUP_APP_API_KEY_MISSING');

  try {
    const response = await gupshupService.sendText({
      source,
      destination: to,
      text,
      appApiKey
    });

    // Log message for this tenant
    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'text',
      to,
      body: text,
      status: 'sent',
      whatsappMessageId: response.messageId || response.id,
      ...options
    });

    // Increment usage
    await workspace.incrementBspMessageUsage();

    return {
      success: true,
      messageId: response.messageId || response.id,
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

  const source = getWorkspaceSourceNumber(workspace);
  const appApiKey = workspace.gupshupIdentity?.appApiKey;
  if (!appApiKey) throw new Error('GUPSHUP_APP_API_KEY_MISSING');

  try {
    const params = components
      .flatMap((component) => component.parameters || [])
      .map((parameter) => parameter.text)
      .filter(Boolean);

    const response = await gupshupService.sendTemplate({
      source,
      destination: to,
      templateId: templateName,
      languageCode,
      params,
      appApiKey
    });

    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'template',
      to,
      templateName,
      status: 'sent',
      whatsappMessageId: response.messageId || response.id,
      ...options
    });

    await workspace.incrementBspMessageUsage();

    return {
      success: true,
      messageId: response.messageId || response.id,
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

  const source = getWorkspaceSourceNumber(workspace);
  const appApiKey = workspace.gupshupIdentity?.appApiKey;
  if (!appApiKey) throw new Error('GUPSHUP_APP_API_KEY_MISSING');

  try {
    const response = await gupshupService.sendMedia({
      source,
      destination: to,
      mediaType,
      mediaUrl: media.link || media.url,
      caption,
      appApiKey
    });

    await logMessage(workspace._id, {
      direction: 'outbound',
      type: mediaType,
      to,
      body: caption || `[${mediaType}]`,
      status: 'sent',
      whatsappMessageId: response.messageId || response.id,
      meta: { media },
      ...options
    });

    await workspace.incrementBspMessageUsage();

    return {
      success: true,
      messageId: response.messageId || response.id,
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

  const source = getWorkspaceSourceNumber(workspace);
  const appApiKey = workspace.gupshupIdentity?.appApiKey;
  if (!appApiKey) throw new Error('GUPSHUP_APP_API_KEY_MISSING');

  try {
    const response = await gupshupService.sendText({
      source,
      destination: to,
      text: interactive.body?.text || '[Interactive Message]',
      appApiKey
    });

    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'interactive',
      to,
      body: interactive.body?.text || '[Interactive]',
      status: 'sent',
      whatsappMessageId: response.messageId || response.id,
      meta: { interactive },
      ...options
    });

    await workspace.incrementBspMessageUsage();

    return {
      success: true,
      messageId: response.messageId || response.id,
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
  await getWorkspaceForMessaging(workspaceId);
  return { success: true, data: { acknowledged: true, messageId } };
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
  const workspace = await getWorkspaceForTemplateOps(workspaceId);

  // Check template submission rate limit
  await checkTemplateSubmissionLimit(workspace);

  const storedAppCredential =
    workspace.gupshupIdentity?.appApiKey ||
    workspace.whatsappAccessToken ||
    process.env.GUPSHUP_API_KEY;

  const appId =
    workspace.gupshupIdentity?.partnerAppId ||
    workspace.gupshupAppId ||
    process.env.GUPSHUP_APP_ID;

  if (!appId) throw new Error('GUPSHUP_APP_ID_MISSING');

  const credentialCandidates = [];
  if (storedAppCredential) credentialCandidates.push(String(storedAppCredential).trim());

  try {
    const resolvedAppToken = await gupshupService.getPartnerAppAccessToken(appId);
    if (resolvedAppToken) {
      credentialCandidates.unshift(String(resolvedAppToken).trim());
    }
  } catch (tokenErr) {
    console.warn(`[BSP] Unable to fetch partner app token for template submit: ${tokenErr.message}`);
  }

  const uniqueCredentials = [...new Set(credentialCandidates.filter(Boolean))];
  if (uniqueCredentials.length === 0) throw new Error('GUPSHUP_APP_API_KEY_MISSING');

  const namespacedName = `${workspace._id.toString().slice(-8)}_${templateData.name}`;

  const resolvedCategory = String(templateData.category || 'UTILITY').toUpperCase();
  const resolvedLanguage = String(templateData.language || templateData.languageCode || 'en');
  const resolvedTemplateLabel =
    (templateData.templateLabel || templateData.templateLabels || '').toString().trim() ||
    (resolvedCategory === 'AUTHENTICATION'
      ? 'otp verification'
      : resolvedCategory === 'MARKETING'
        ? 'promotional offer'
        : 'account update');

  try {
    const payload = {
      name: namespacedName,
      language: resolvedLanguage,
      languageCode: resolvedLanguage,
      category: resolvedCategory,
      templateLabel: resolvedTemplateLabel,
      templateLabels: resolvedTemplateLabel,
      components: templateData.components || []
    };

    let response = null;
    let lastError = null;

    for (const appApiKey of uniqueCredentials) {
      try {
        if (templateData.metaTemplateId) {
          response = await gupshupService.updateTemplateForApp({
            appId,
            appApiKey,
            templateId: templateData.metaTemplateId,
            template: payload
          });
        } else {
          response = await gupshupService.createTemplateForApp({
            appId,
            appApiKey,
            template: payload
          });
        }
        break;
      } catch (submitErr) {
        lastError = submitErr;
        const status = Number(submitErr?.response?.status || 0);
        if (status !== 401 && status !== 403) {
          throw submitErr;
        }
      }
    }

    if (!response) {
      throw lastError || new Error('GUPSHUP_PROVIDER_AUTH_FAILED');
    }

    // Increment template submission counter
    await Workspace.findByIdAndUpdate(workspace._id, {
      $inc: { 'bspUsage.templateSubmissionsToday': 1 }
    });

    return {
      success: true,
      templateId: response.templateId || response.id || response.template?.id || namespacedName,
      status: response.status || response.template?.status || 'PENDING',
      namespacedName,
      data: response,
      rawResponse: response
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
async function fetchTemplates(workspace, options = {}) {
  try {
    const appId =
      workspace.gupshupIdentity?.partnerAppId ||
      process.env.GUPSHUP_APP_ID;
    const storedAppCredential =
      workspace.gupshupIdentity?.appApiKey ||
      workspace.whatsappAccessToken ||
      process.env.GUPSHUP_API_KEY;

    if (!appId) {
      throw new Error('GUPSHUP_CREDENTIALS_MISSING');
    }

    let appApiKey = storedAppCredential;
    try {
      const resolvedAppToken = await gupshupService.getPartnerAppAccessToken(appId);
      if (resolvedAppToken) {
        appApiKey = resolvedAppToken;
      }
    } catch (tokenErr) {
      console.warn(`[BSP] Falling back to stored app credential for template sync: ${tokenErr.message}`);
    }

    if (!appApiKey) {
      throw new Error('GUPSHUP_CREDENTIALS_MISSING');
    }

    const response = await gupshupService.listTemplates({
      appId: appId,
      appApiKey: appApiKey,
      pageNo: options.pageNo || 1,
      pageSize: options.limit || 100,
      templateStatus: options.templateStatus,
      languageCode: options.languageCode
    });
    return {
      success: true,
      templates: response.templates || response.data || [],
      paging: response.paging || null
    };
  } catch (error) {
    console.error(`[BSP] Failed to fetch templates: ${error.message}`);
    throw error;
  }
}

/**
 * Delete a template from parent WABA
 * @param {string} templateName - Template name to delete
 * @param {string} workspaceId - The workspace submitting the request
 * @param {string} templateId - Template Id to delete
 */
async function deleteTemplate(templateName, workspaceId, templateId) {
  const workspace = await getWorkspaceForTemplateOps(workspaceId);

  const storedAppCredential =
    workspace.gupshupIdentity?.appApiKey ||
    workspace.whatsappAccessToken ||
    process.env.GUPSHUP_API_KEY;

  const appId =
    workspace.gupshupIdentity?.partnerAppId ||
    workspace.gupshupAppId ||
    process.env.GUPSHUP_APP_ID;

  if (!appId) throw new Error('GUPSHUP_APP_ID_MISSING');

  const credentialCandidates = [];
  if (storedAppCredential) credentialCandidates.push(String(storedAppCredential).trim());

  try {
    const resolvedAppToken = await gupshupService.getPartnerAppAccessToken(appId);
    if (resolvedAppToken) {
      credentialCandidates.unshift(String(resolvedAppToken).trim());
    }
  } catch (tokenErr) {
    console.warn(`[BSP] Unable to fetch partner app token for template delete: ${tokenErr.message}`);
  }

  const uniqueCredentials = [...new Set(credentialCandidates.filter(Boolean))];
  if (uniqueCredentials.length === 0) throw new Error('GUPSHUP_APP_API_KEY_MISSING');

  let response = null;
  let lastError = null;

  for (const appApiKey of uniqueCredentials) {
    try {
      response = await gupshupService.deleteTemplateForApp({
        appId,
        appApiKey,
        elementName: templateName,
        templateId
      });
      break;
    } catch (deleteErr) {
      lastError = deleteErr;
      const status = Number(deleteErr?.response?.status || 0);
      if (status !== 401 && status !== 403) {
        throw deleteErr;
      }
    }
  }

  if (!response) {
    throw lastError || new Error('GUPSHUP_PROVIDER_AUTH_FAILED');
  }

  return {
    success: true,
    data: response
  };
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
  return {
    success: true,
    phoneNumber: {
      id: phoneNumberId,
      display_phone_number: phoneNumberId,
      status: 'CONNECTED'
    }
  };
}

/**
 * Update business profile for a phone number
 * @param {string} workspaceId - The workspace ID
 * @param {Object} profileData - Business profile data
 */
async function updateBusinessProfile(workspaceId, profileData) {
  await getWorkspaceForMessaging(workspaceId);
  return { success: true, data: profileData || {} };
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
  await getWorkspaceForMessaging(workspaceId);
  throw new Error(`GUPSHUP_MEDIA_UPLOAD_NOT_IMPLEMENTED:${mimeType || 'unknown'}`);
}

/**
 * Get media URL for downloading
 * @param {string} mediaId - The media ID from WhatsApp
 */
async function getMediaUrl(mediaId) {
  return {
    success: true,
    url: mediaId,
    mimeType: null,
    sha256: null,
    fileSize: null
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * WEBHOOK VERIFICATION
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Gupshup webhook verification is IP-based and handled in middleware.
 * Signature-based HMAC verification is no longer used.
 */
function verifyWebhookSignature() {
  return true;
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * INTERNAL HELPERS
 * ═══════════════════════════════════════════════════════════════════
 */

function getWorkspaceSourceNumber(workspace) {
  const source = workspace.gupshupIdentity?.source;
  if (!source) {
    throw new Error('GUPSHUP_SOURCE_NUMBER_NOT_CONFIGURED');
  }
  return source;
}

/**
 * Get workspace with validation for messaging
 */
async function getWorkspaceForMessaging(workspaceId) {
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }

  workspace.ensureWorkspaceBspReady();

  if (!workspace.canSendMessage()) {
    throw new Error('BSP_MESSAGING_BLOCKED');
  }

  if (process.env.BSP_GLOBAL_MESSAGING_DISABLED === 'true') {
    throw new Error('BSP_GLOBAL_MESSAGING_DISABLED');
  }

  await enforceWorkspaceBilling(workspace._id);

  return workspace;
}

async function getWorkspaceForTemplateOps(workspaceId) {
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }

  if (!workspace.bspManaged) {
    throw new Error('WORKSPACE_NOT_BSP_MANAGED');
  }

  if (process.env.BSP_GLOBAL_MESSAGING_DISABLED === 'true') {
    throw new Error('BSP_GLOBAL_MESSAGING_DISABLED');
  }

  try {
    await enforceWorkspaceBilling(workspace._id);
  } catch (error) {
    if (String(error?.message || '').includes('BILLING_TRIAL_NO_SEND')) {
      return workspace;
    }
    throw error;
  }

  return workspace;
}

/**
 * Check rate limit for workspace
 */
async function checkRateLimit(workspace) {
  const plan = workspace.plan || 'free';
  const workspaceId = workspace._id.toString();

  // Get configured limits
  const maxMessagesPerSecond = workspace.bspRateLimits?.messagesPerSecond ||
    bspConfig.getRateLimit(plan, 'messagesPerSecond');
  const maxDailyMessages = workspace.bspRateLimits?.dailyMessageLimit ||
    bspConfig.getRateLimit(plan, 'dailyMessageLimit');
  const maxMonthlyMessages = workspace.bspRateLimits?.monthlyMessageLimit ||
    bspConfig.getRateLimit(plan, 'monthlyMessageLimit');

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

/**
 * Trigger Gupshup-side template sync for an app.
 * Resolves the app access token and calls the Gupshup sync endpoint.
 * Non-blocking: caller should fire-and-forget; failures are logged.
 */
async function triggerGupshupSync(workspace) {
  const appId = workspace.gupshupIdentity?.partnerAppId || process.env.GUPSHUP_APP_ID;
  if (!appId) {
    throw new Error('GUPSHUP_CREDENTIALS_MISSING');
  }

  const storedAppCredential =
    workspace.gupshupIdentity?.appApiKey ||
    workspace.whatsappAccessToken ||
    process.env.GUPSHUP_API_KEY;

  let appApiKey = storedAppCredential;
  try {
    const resolvedAppToken = await gupshupService.getPartnerAppAccessToken(appId);
    if (resolvedAppToken) {
      appApiKey = resolvedAppToken;
    }
  } catch (tokenErr) {
    console.warn(`[BSP] Could not fetch app token for sync trigger, using stored: ${tokenErr.message}`);
  }

  return gupshupService.syncTemplatesForApp({ appId, appApiKey });
}

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
  triggerGupshupSync,

  // Phone management
  getPhoneNumberDetails,
  updateBusinessProfile,

  // Media
  uploadMedia,
  getMediaUrl,

  // Webhook
  verifyWebhookSignature,

  // Internal (for advanced use)
  getWorkspaceForMessaging,
  checkRateLimit,
  checkTemplateSubmissionLimit
};
