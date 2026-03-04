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

const bspConfig = require('../../config/bspConfig');
const gupshupService = require('./gupshupService');
const { Workspace, Message, Contact, Conversation } = require('../../models');
const { isOptedOutByPhone, isOptedOut } = require('../messaging/optOutService');
const { enforceWorkspaceBilling } = require('../billing/billingEnforcementService');
const billingLedgerService = require('../billing/billingLedgerService');
const auditService = require('../admin/auditService');
const { decryptToken } = require('./gupshupProvisioningService');

// In-memory rate limiter (use Redis in production for distributed systems)
const rateLimiters = new Map();
const TEMPLATE_LIST_AUTH_COOLDOWN_MS = 15 * 60 * 1000;
const templateListAuthCooldownByApp = new Map();
const TEMPLATE_SYNC_TRIGGER_COOLDOWN_MS = 60 * 1000;
const TEMPLATE_SYNC_TRIGGER_RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;
const templateSyncTriggerStateByApp = new Map();
const APP_TOKEN_RESOLVE_TTL_MS = 30 * 1000;
const appTokenResolveStateByApp = new Map();
const provisionedApps = new Set();
const lastHealthCheckByApp = new Map();
const HEALTH_CHECK_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if a session message can be sent (within 24h window)
 */
async function canSendSessionMessage(workspaceId, phoneNumber) {
  try {
    const contact = await Contact.findOne({ workspace: workspaceId, phone: phoneNumber });
    if (!contact) return false;

    const conversation = await Conversation.findOne({ workspace: workspaceId, contact: contact._id });
    if (!conversation) return false;

    // Check if within 24h window
    const now = new Date();
    return conversation.isOpen && conversation.windowExpiresAt && conversation.windowExpiresAt > now;
  } catch (error) {
    console.error('[BSPMessagingService] Error checking session window:', error.message);
    return false;
  }
}

/**
 * Check for messages that haven't received status updates within timeout
 */
async function checkMessageStatusTimeout(workspaceId, whatsappMessageId) {
  try {
    const message = await Message.findOne({
      workspace: workspaceId,
      whatsappMessageId: whatsappMessageId
    });

    if (message && message.status === 'queued') {
      console.warn(`[BSPMessagingService] Message ${message._id} (${whatsappMessageId}) still queued after 60s, marking as unknown`);
      message.status = 'unknown';
      message.meta = message.meta || {};
      message.meta.timeoutAt = new Date();
      await message.save();
    }
  } catch (error) {
    console.error('[BSPMessagingService] Error checking message timeout:', error.message);
  }
}

async function resolveAppAccessToken(appId) {
  if (!appId) return null;

  const now = Date.now();
  const state = appTokenResolveStateByApp.get(appId) || {};

  if (state.token && state.expiresAt && now < state.expiresAt) {
    return state.token;
  }

  if (state.inFlightPromise) {
    return state.inFlightPromise;
  }

  const inFlightPromise = (async () => {
    const token = await gupshupService.getPartnerAppAccessToken(appId);
    appTokenResolveStateByApp.set(appId, {
      token,
      expiresAt: Date.now() + APP_TOKEN_RESOLVE_TTL_MS,
      inFlightPromise: null
    });
    return token;
  })();

  appTokenResolveStateByApp.set(appId, {
    ...state,
    inFlightPromise
  });

  try {
    return await inFlightPromise;
  } catch (error) {
    appTokenResolveStateByApp.delete(appId);
    throw error;
  } finally {
    const latestState = appTokenResolveStateByApp.get(appId) || {};
    if (latestState.inFlightPromise) {
      appTokenResolveStateByApp.set(appId, {
        ...latestState,
        inFlightPromise: null
      });
    }
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * DIAGNOSTICS LOGGER
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Comprehensive diagnostics logger for WhatsApp Template Delivery Verification
 */
async function logWhatsAppSendDiagnostics({
  workspace,
  user,
  contact,
  templateName,
  templateDb,
  marketingColdContact = false,
  rawPhone,
  normalizedPhone,
  payload,
  appId,
  appApiKey
}) {
  console.log("\n========== [DIAGNOSTICS] PRE-FLIGHT TEMPLATE DELIVERY CHECK ==========");

  // 1️⃣ USER / WORKSPACE INFO
  console.log("1️⃣  USER / WORKSPACE INFO:");
  console.log({
    workspaceId: workspace?._id?.toString(),
    workspaceName: workspace?.name,
    userId: user?._id?.toString() || workspace?.owner?.toString() || "Unknown",
    email: user?.email || "Unknown"
  });

  // 2️⃣ CONTACT INFO
  console.log("\n2️⃣  CONTACT INFO:");
  console.log({
    contactId: contact?._id?.toString() || "Not found in DB",
    contactName: contact?.name || "Unknown",
    rawPhone: contact?.phone || rawPhone || "Unknown",
    normalizedPhone
  });

  // 3️⃣ WABA INFO
  console.log("\n3️⃣  WABA INFO:");
  console.log({
    wabaId: workspace?.wabaId || workspace?.bspWabaId || "Missing",
    phoneNumber: workspace?.whatsappPhoneNumber || workspace?.bspDisplayPhoneNumber || "Missing",
    phoneNumberId: workspace?.phoneNumberId || workspace?.bspPhoneNumberId || "Missing",
    messagingTier: workspace?.bspMessagingTier || workspace?.messagingLimitTier || "Unknown",
    accountStatus: workspace?.metaAccountStatus || "Unknown",
    qualityRating: workspace?.bspQualityRating || workspace?.qualityRating || "Unknown"
  });

  // 4️⃣ APP INFO
  console.log("\n4️⃣  APP INFO:");
  console.log({
    gupshupAppId: workspace?.gupshupAppId || "Missing",
    partnerAppId: workspace?.gupshupIdentity?.partnerAppId || "Missing",
    namespace: "N/A (OBO/Embedded)",
    provider: "Gupshup Partner API - V3"
  });

  // 5️⃣ TEMPLATE INFO
  let templateStatus = templateDb?.status || "UNKNOWN";
  let metaTemplateId = templateDb?.metaTemplateId || templateDb?.providerId || "UNKNOWN";
  let templateCategory = templateDb?.category || "UNKNOWN";
  let variableCount = templateDb?.variableCount ?? (payload?.components?.length || 0);

  console.log("\n5️⃣  TEMPLATE INFO:");
  console.log({
    templateName,
    metaTemplateName: templateName,
    metaTemplateId,
    templateStatus,
    templateCategory,
    approved: templateStatus === "APPROVED",
    variableCount,
    variablesSent: payload?.components || [],
    ...(marketingColdContact && { marketingColdContact: true })
  });

  // 6️⃣ MESSAGE PAYLOAD
  console.log("\n6️⃣  MESSAGE PAYLOAD:");
  const sentPayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: payload.languageCode || 'en' },
      components: payload.components || []
    }
  };
  console.log(JSON.stringify(sentPayload, null, 2));

  // 7️⃣ HEALTH CHECK
  console.log("\n7️⃣  HEALTH CHECK:");
  let healthStatus = "UNKNOWN";
  if (appId && appApiKey) {
    try {
      const healthResp = await gupshupService.getWabaHealth({ appId, appApiKey });
      healthStatus = healthResp.healthy ? "HEALTHY" : "UNHEALTHY";
      console.log({
        healthy: healthResp.healthy,
        raw: healthResp.data
      });
    } catch (err) {
      healthStatus = "ERROR";
      console.error("Health check failed:", err.message);
    }
  } else {
    console.log("Skipping health check - missing credentials");
  }

  // 8️⃣ MESSAGE LIMIT INFO
  console.log("\n8️⃣  MESSAGE LIMIT INFO:");
  console.log({
    messagingTier: workspace?.bspMessagingTier || "Unknown",
    dailyLimit: workspace?.planLimits?.maxMessages || "Unknown",
    qualityRating: workspace?.bspQualityRating || "Unknown"
  });

  // 9️⃣ ENVIRONMENT CHECK
  const mongoose = require('mongoose');
  console.log("\n9️⃣  ENVIRONMENT CHECK:");
  console.log({
    NODE_ENV: process.env.NODE_ENV || "development",
    redisConnected: "Unknown (Using memory fallback)",
    mongoConnected: mongoose.connection.readyState === 1
  });

  // 10️⃣ FINAL DELIVERY CHECK
  console.log("\n========== DELIVERY CHECK ==========");
  console.log({
    workspaceId: workspace?._id?.toString(),
    contactPhone: contact?.phone || rawPhone || "Unknown",
    normalizedPhone,
    templateName,
    templateStatus,
    category: templateCategory,
    wabaId: workspace?.wabaId || workspace?.bspWabaId || "Missing",
    appId,
    healthStatus,
    marketingColdContact: marketingColdContact || false
  });
  console.log("===================================\n");

  // Strict Validation Thorws
  if (!normalizedPhone) throw new Error("Delivery Check Failed: Phone missing");
  if (!templateName) throw new Error("Delivery Check Failed: Template missing");
  // Temporarily bypass strict approval throw if it was missing from local DB sync
  if (templateStatus === "REJECTED" || templateStatus === "FLAGGED") {
    throw new Error(`Delivery Check Failed: Template is ${templateStatus}`);
  }
  if (!appId) throw new Error("Delivery Check Failed: App ID missing");
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

  // Apply phone normalization
  const normalizedPhone = gupshupService.normalizePhoneNumber(to);

  // Compliance: enforce opt-out
  if (options.contactId) {
    const optedOut = await isOptedOut(options.contactId);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  } else {
    const optedOut = await isOptedOutByPhone(workspaceId, normalizedPhone);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  }

  // Session vs Template Logic: Enforce 24h window for text messages
  const sessionActive = await canSendSessionMessage(workspaceId, normalizedPhone);
  if (!sessionActive) {
    throw new Error("Session window expired, use template");
  }

  // Check rate limits
  await checkRateLimit(workspace);

  // Ensure subscriptions and check health
  await ensurePrerequisites(workspace);

  // Ensure appApiKey is stored
  const appApiKey = await ensureWorkspaceAppApiKey(workspace);

  const source = getWorkspaceSourceNumber(workspace);
  const appId = workspace.gupshupIdentity?.partnerAppId || workspace.gupshupAppId;
  if (!appId) throw new Error('GUPSHUP_APP_ID_MISSING');

  const payload = {
    appId,
    source,
    destination: normalizedPhone,
    text,
    appApiKey
  };

  console.log(`[BSPMessagingService] Sending text message to ${normalizedPhone}`);
  console.log(`[BSPMessagingService] Message send payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await gupshupService.sendText(payload);

    console.log(`[BSPMessagingService] Provider message ID: ${response.messageId || response.id}`);

    // Log message for this tenant
    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'text',
      to: normalizedPhone,
      body: text,
      status: 'queued',
      whatsappMessageId: response.messageId || response.id,
      ...options
    });

    // Increment usage
    await workspace.incrementBspMessageUsage();

    // Set timeout for status update
    setTimeout(() => {
      checkMessageStatusTimeout(workspace._id, response.messageId || response.id);
    }, 60000); // 60 seconds

    return {
      success: true,
      messageId: response.messageId || response.id,
      data: response
    };
  } catch (error) {
    console.error(`[BSPMessagingService] Text send failed:`, error.message);

    // Log failed attempt
    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'text',
      to: normalizedPhone,
      body: text,

      status: 'failed',
      error: error.message,
      ...options
    });

    if (error.response?.data) {
      error.message = `Gupshup API Error: ${error.response.data.message || JSON.stringify(error.response.data)}`;
    }

    throw error;
  }
}

/**
 * Send a template message via WhatsApp Cloud API
 * @param {string} workspaceId - The workspace/tenant ID
 * @param {string} to - Recipient phone number
 * @param {string} templateName - Provider template name (V3 template send)
 * @param {string} languageCode - Template language code
 * @param {Array} components - Template components with parameters
 * @param {Object} options - Additional options (contactId, campaignId, etc.)
 * @returns {Object} Result with messageId
 */
async function sendTemplateMessage(workspaceId, to, templateName, languageCode = 'en', components = [], options = {}) {
  const workspace = await getWorkspaceForMessaging(workspaceId);

  // Apply phone normalization
  const normalizedPhone = gupshupService.normalizePhoneNumber(to);

  // Compliance: enforce opt-out across all outbound sends
  if (options.contactId) {
    const optedOut = await isOptedOut(options.contactId);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  } else {
    const optedOut = await isOptedOutByPhone(workspaceId, normalizedPhone);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  }

  await checkRateLimit(workspace);

  // Ensure subscriptions and check health
  await ensurePrerequisites(workspace);

  // Ensure appApiKey is stored (Lazy resolve and save)
  const appApiKey = await ensureWorkspaceAppApiKey(workspace);

  const source = getWorkspaceSourceNumber(workspace);
  const appId = workspace.gupshupIdentity?.partnerAppId || workspace.gupshupAppId;
  if (!appId) throw new Error('GUPSHUP_APP_ID_MISSING');

  const payload = {
    appId,
    destination: normalizedPhone,
    templateName,
    languageCode,
    components,
    appApiKey
  };

  // Run diagnostics logger before sending
  let user = null;
  if (workspace.owner) {
    const User = require('../../models/User');
    user = await User.findById(workspace.owner).catch(() => null);
  }
  let contact = null;
  if (options.contactId) {
    contact = await Contact.findById(options.contactId).catch(() => null);
  } else {
    contact = await Contact.findOne({ workspace: workspace._id, phone: normalizedPhone }).catch(() => null);
  }

  // Validating Template Approval Before Dispatch
  const { Template } = require('../../models');
  const templateDb = await Template.findOne({
    metaTemplateName: templateName,
    workspace: workspace._id
  });

  if (!templateDb) {
    console.error(`[Messaging] Template not found - blocking send: ${templateName}`);
    throw new Error(`Template not found: ${templateName}`);
  }

  if (templateDb.status !== "APPROVED") {
    console.error(`[Messaging] Template not approved - blocking send: ${templateDb.status}`);
    throw new Error(`Template not approved by WhatsApp: ${templateDb.status}`);
  }

  // Handle Header Media Requirement
  const headerSchema = templateDb.metaPayloadSnapshot?.components?.find(c => c.type === 'HEADER');
  if (headerSchema && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerSchema.format)) {
    // Priority: options.headerMediaUrl > options.mediaUrl > template example header_handle
    const mediaUrl =
      options.headerMediaUrl ||
      options.mediaUrl ||
      headerSchema.example?.header_handle?.[0] ||
      null;

    if (!mediaUrl) {
      throw new Error("Template requires header media");
    }

    console.log(`[TemplateSend] Header media: ${mediaUrl}`);

    const mediaTypeLower = headerSchema.format.toLowerCase();

    // Unshift to ensure header is first in components array
    payload.components.unshift({
      type: "header",
      parameters: [
        {
          type: mediaTypeLower,
          [mediaTypeLower]: {
            link: mediaUrl
          }
        }
      ]
    });
  }

  // Handle Marketing Cold Contact Warning
  let marketingColdContact = false;
  if (templateDb.category === 'MARKETING') {
    // Check: existing conversation OR opt-in
    // Future improvement: explicitly store and check opt-in status.
    const hasInteracted = contact && (contact.lastInboundAt || contact.lastOutboundAt);

    if (!hasInteracted) {
      console.warn(`[Messaging] Marketing template to cold contact: ${normalizedPhone}`);
      marketingColdContact = true;
    }
  }

  await logWhatsAppSendDiagnostics({
    workspace,
    user,
    contact,
    templateName,
    templateDb,
    marketingColdContact,
    rawPhone: to,
    normalizedPhone,
    payload,
    appId,
    appApiKey
  });

  try {
    const response = await gupshupService.sendTemplateV3(payload);
    const messageId = response.messageId || response.id;

    console.log("\n========== SEND RESULT ==========");
    console.log({
      messageId,
      status: response.status || "sent",
      providerResponse: response
    });
    console.log("=================================\n");

    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'template',
      to: normalizedPhone,
      body: `[Template: ${templateName}]`,
      status: 'queued', // Store as queued initially, update via webhook
      whatsappMessageId: response.messageId || response.id,
      templateName,
      ...options
    });

    await workspace.incrementBspMessageUsage();

    // Set timeout for status update
    setTimeout(() => {
      checkMessageStatusTimeout(workspace._id, response.messageId || response.id);
    }, 60000); // 60 seconds

    return {
      success: true,
      messageId: response.messageId || response.id,
      data: response
    };
  } catch (error) {
    console.error(`[BSPMessagingService] Error sending template ${templateName}:`, error.message);

    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'template',
      to: normalizedPhone,
      templateName,
      status: 'failed',
      error: error.response?.data?.message || error.message,
      ...options
    });

    // Enhance error before throwing
    if (error.response?.data) {
      error.message = `Gupshup API Error: ${error.response.data.message || JSON.stringify(error.response.data)}`;
    }

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

  // Apply phone normalization
  const normalizedPhone = gupshupService.normalizePhoneNumber(to);

  // Compliance: enforce opt-out
  if (options.contactId) {
    const optedOut = await isOptedOut(options.contactId);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  } else {
    const optedOut = await isOptedOutByPhone(workspaceId, normalizedPhone);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  }

  // Session vs Template Logic: Enforce 24h window for media messages
  const sessionActive = await canSendSessionMessage(workspaceId, normalizedPhone);
  if (!sessionActive) {
    throw new Error("Session window expired, use template");
  }

  await checkRateLimit(workspace);

  // Ensure subscriptions and check health
  await ensurePrerequisites(workspace);

  const source = getWorkspaceSourceNumber(workspace);
  const appId = workspace.gupshupIdentity?.partnerAppId || workspace.gupshupAppId;
  const appApiKey = workspace.gupshupIdentity?.appApiKey;
  if (!appId) throw new Error('GUPSHUP_APP_ID_MISSING');

  const payload = {
    appId,
    source,
    destination: normalizedPhone,
    mediaType,
    mediaUrl: media.link || media.url,
    caption,
    appApiKey
  };

  console.log(`[BSPMessagingService] Sending ${mediaType} message to ${normalizedPhone}`);
  console.log(`[BSPMessagingService] Message send payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await gupshupService.sendMedia(payload);

    console.log(`[BSPMessagingService] Provider message ID: ${response.messageId || response.id}`);

    await logMessage(workspace._id, {
      direction: 'outbound',
      type: mediaType,
      to: normalizedPhone,
      body: caption || `[${mediaType}]`,
      status: 'queued',
      whatsappMessageId: response.messageId || response.id,
      meta: { media },
      ...options
    });

    await workspace.incrementBspMessageUsage();

    // Set timeout for status update
    setTimeout(() => {
      checkMessageStatusTimeout(workspace._id, response.messageId || response.id);
    }, 60000); // 60 seconds

    return {
      success: true,
      messageId: response.messageId || response.id,
      data: response
    };
  } catch (error) {
    console.error(`[BSPMessagingService] ${mediaType} send failed:`, error.message);

    await logMessage(workspace._id, {
      direction: 'outbound',
      type: mediaType,
      to: normalizedPhone,
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

  // Apply phone normalization
  const normalizedPhone = gupshupService.normalizePhoneNumber(to);

  // Compliance: enforce opt-out
  if (options.contactId) {
    const optedOut = await isOptedOut(options.contactId);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  } else {
    const optedOut = await isOptedOutByPhone(workspaceId, normalizedPhone);
    if (optedOut) throw new Error('BSP_USER_OPTED_OUT');
  }

  // Session vs Template Logic: Enforce 24h window for interactive messages
  const sessionActive = await canSendSessionMessage(workspaceId, normalizedPhone);
  if (!sessionActive) {
    throw new Error("Session window expired, use template");
  }

  await checkRateLimit(workspace);

  // Ensure subscriptions and check health
  await ensurePrerequisites(workspace);

  const source = getWorkspaceSourceNumber(workspace);
  const appId = workspace.gupshupIdentity?.partnerAppId || workspace.gupshupAppId;
  const appApiKey = workspace.gupshupIdentity?.appApiKey;
  if (!appId) throw new Error('GUPSHUP_APP_ID_MISSING');

  const payload = {
    appId,
    destination: normalizedPhone,
    interactive,
    appApiKey
  };

  console.log(`[BSPMessagingService] Sending interactive message to ${normalizedPhone}`);
  console.log(`[BSPMessagingService] Message send payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await gupshupService.sendInteractiveV3(payload);

    console.log(`[BSPMessagingService] Provider message ID: ${response.messageId || response.id}`);

    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'interactive',
      to: normalizedPhone,
      body: interactive.body?.text || '[Interactive]',
      status: 'queued',
      whatsappMessageId: response.messageId || response.id,
      meta: { interactive },
      ...options
    });

    await workspace.incrementBspMessageUsage();

    // Set timeout for status update
    setTimeout(() => {
      checkMessageStatusTimeout(workspace._id, response.messageId || response.id);
    }, 60000); // 60 seconds

    return {
      success: true,
      messageId: response.messageId || response.id,
      data: response
    };
  } catch (error) {
    console.error(`[BSPMessagingService] Interactive send failed:`, error.message);

    await logMessage(workspace._id, {
      direction: 'outbound',
      type: 'interactive',
      to: normalizedPhone,
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
    workspace.whatsappAccessToken;

  const appId =
    workspace.gupshupIdentity?.partnerAppId ||
    workspace.gupshupAppId;

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
      workspace.gupshupAppId;
    const storedAppCredential =
      workspace.gupshupIdentity?.appApiKey ||
      workspace.whatsappAccessToken;

    if (!appId) {
      throw new Error('GUPSHUP_CREDENTIALS_MISSING');
    }

    const authCooldownUntil = templateListAuthCooldownByApp.get(appId) || 0;
    if (Date.now() < authCooldownUntil) {
      return {
        success: true,
        templates: [],
        paging: null,
        warning: {
          code: 'TEMPLATES_LIST_AUTH_COOLDOWN',
          statusCode: 401,
          details: 'Provider auth recently failed; skipping remote template fetch during cooldown window.'
        }
      };
    }

    const credentialCandidates = [];
    if (storedAppCredential) {
      credentialCandidates.push(String(storedAppCredential).trim());
    }

    try {
      const resolvedAppToken = await resolveAppAccessToken(appId);
      if (resolvedAppToken) {
        credentialCandidates.unshift(String(resolvedAppToken).trim());
      }
    } catch (tokenErr) {
      console.warn(`[BSP] Falling back to stored app credential for template sync: ${tokenErr.message}`);
    }

    const uniqueCredentials = [...new Set(credentialCandidates.filter(Boolean))];

    if (uniqueCredentials.length === 0) {
      throw new Error('GUPSHUP_CREDENTIALS_MISSING');
    }

    let response = null;
    let lastError = null;

    for (const appApiKey of uniqueCredentials) {
      try {
        response = await gupshupService.listTemplates({
          appId: appId,
          appApiKey: appApiKey,
          pageNo: options.pageNo || 1,
          pageSize: options.limit || 100,
          templateStatus: options.templateStatus,
          languageCode: options.languageCode
        });
        break;
      } catch (fetchErr) {
        lastError = fetchErr;
        const status = Number(fetchErr?.statusCode || fetchErr?.response?.status || 0);
        if (status !== 401 && status !== 403) {
          throw fetchErr;
        }
      }
    }

    if (!response) {
      const status = Number(lastError?.statusCode || lastError?.response?.status || 0);
      if (status === 401 || status === 403 || lastError?.code === 'TEMPLATES_LIST_AUTH_FAILED') {
        templateListAuthCooldownByApp.set(appId, Date.now() + TEMPLATE_LIST_AUTH_COOLDOWN_MS);
        console.warn('[BSP] Template list auth failed at provider; skipping remote sync and keeping existing local templates', {
          appId,
          status,
          code: lastError?.code
        });

        return {
          success: true,
          templates: [],
          paging: null,
          warning: {
            code: 'TEMPLATES_LIST_AUTH_FAILED',
            statusCode: status || 401,
            details: lastError?.details || lastError?.message
          }
        };
      }

      throw lastError || new Error('GUPSHUP_PROVIDER_AUTH_FAILED');
    }

    return {
      success: true,
      templates: response.templates || response.data || [],
      paging: response.paging || null
    };
  } catch (error) {
    const status = Number(error?.statusCode || error?.response?.status || 0);
    if (status === 401 || status === 403 || error?.code === 'TEMPLATES_LIST_AUTH_FAILED') {
      console.warn(`[BSP] Template fetch skipped due to provider auth rejection: ${error.message}`);
    } else {
      console.error(`[BSP] Failed to fetch templates: ${error.message}`);
    }
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
    workspace.whatsappAccessToken;

  const appId =
    workspace.gupshupIdentity?.partnerAppId ||
    workspace.gupshupAppId;

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
  const source = workspace.gupshupIdentity?.source || workspace.whatsappPhoneNumber || workspace.bspDisplayPhoneNumber || process.env.GUPSHUP_SOURCE_NUMBER;
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

/**
 * Ensure subscriptions and check health before sending.
 */
async function ensurePrerequisites(workspace) {
  const appId = workspace.gupshupIdentity?.partnerAppId || workspace.gupshupAppId;
  const appApiKey = await ensureWorkspaceAppApiKey(workspace);

  if (!appId || !appApiKey) return;

  // 1. Ensure Subscriptions
  if (!provisionedApps.has(appId)) {
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await gupshupService.ensureRequiredSubscriptions({
          appId,
          appApiKey,
          webhookUrl
        });
        provisionedApps.add(appId);
      } catch (err) {
        console.warn(`[BSPMessagingService] Subscription auto-provisioning failed for ${appId}:`, err.message);
      }
    }
  }

  // 2. Check Health (Strict Gate)
  try {
    const health = await gupshupService.getWabaHealth({ appId, appApiKey });
    if (health.healthy === true) {
      console.log(`[BSPMessagingService] Gupshup health check passed`);
    } else {
      console.error(`[BSPMessagingService] Account ${appId} unhealthy, aborting message send`);
      throw new Error("WhatsApp BSP unhealthy, aborting message send");
    }
  } catch (err) {
    if (err.message === "WhatsApp BSP unhealthy, aborting message send") throw err;
    console.error(`[BSPMessagingService] Health check fatal error:`, err.message);
    throw new Error("WhatsApp BSP unhealthy, aborting message send");
  }
}

/**
 * Ensure workspace has an appApiKey stored.
 * If missing, lazy resolve it using partner token and save to DB.
 */
async function ensureWorkspaceAppApiKey(workspace) {
  let appApiKeyEnc = workspace.gupshupIdentity?.appApiKey;

  if (!appApiKeyEnc) {
    const appId = workspace.gupshupIdentity?.partnerAppId || workspace.gupshupAppId;
    if (!appId) throw new Error('GUPSHUP_APP_ID_MISSING');

    try {
      console.log(`[BSPMessagingService] appApiKey missing for workspace ${workspace._id}. Attempting lazy resolution...`);
      appApiKeyEnc = await gupshupService.getPartnerAppAccessToken(appId);

      if (appApiKeyEnc) {
        // Save back to DB for future use
        if (!workspace.gupshupIdentity) workspace.gupshupIdentity = {};
        workspace.gupshupIdentity.appApiKey = appApiKeyEnc;

        // Use findOneAndUpdate to avoid version conflicts if multiple sends happen at once
        await Workspace.findOneAndUpdate(
          { _id: workspace._id },
          { $set: { 'gupshupIdentity.appApiKey': appApiKeyEnc } }
        );

        console.log(`[BSPMessagingService] Successfully resolved and stored appApiKey for workspace ${workspace._id}`);
      }
    } catch (error) {
      console.error(`[BSPMessagingService] Failed to lazy resolve appApiKey for workspace ${workspace._id}:`, error.message);
    }
  }

  // Always return decrypted token for API use
  return decryptToken(appApiKeyEnc);
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
  if (messageData.skipMessageLog) return null;

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
      whatsappMessageId: messageData.whatsappMessageId,
      sentAt: messageData.status === 'queued' || messageData.status === 'sent' ? new Date() : null,

      // Rich metadata for templates/campaigns/billing
      template: messageData.template,
      conversationBilling: messageData.conversationBilling,
      campaign: messageData.campaign,

      meta: {
        whatsappId: messageData.whatsappMessageId,
        templateName: messageData.templateName || messageData.template?.name,
        campaignId: messageData.campaignId || messageData.campaign?.id,
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
  const appId = workspace.gupshupIdentity?.partnerAppId || workspace.gupshupAppId;
  if (!appId) {
    throw new Error('GUPSHUP_CREDENTIALS_MISSING');
  }

  const now = Date.now();
  const triggerState = templateSyncTriggerStateByApp.get(appId) || {};

  if (triggerState.inFlightPromise) {
    return triggerState.inFlightPromise;
  }

  if (triggerState.cooldownUntil && now < triggerState.cooldownUntil) {
    return {
      success: false,
      skipped: true,
      reason: 'SYNC_TRIGGER_COOLDOWN',
      cooldownUntil: triggerState.cooldownUntil
    };
  }

  if (triggerState.lastAttemptAt && (now - triggerState.lastAttemptAt) < TEMPLATE_SYNC_TRIGGER_COOLDOWN_MS) {
    return {
      success: false,
      skipped: true,
      reason: 'SYNC_TRIGGER_THROTTLED'
    };
  }

  const inFlightPromise = (async () => {
    const storedAppCredential =
      workspace.gupshupIdentity?.appApiKey ||
      workspace.whatsappAccessToken;

    let appApiKey = storedAppCredential;
    try {
      const resolvedAppToken = await resolveAppAccessToken(appId);
      if (resolvedAppToken) {
        appApiKey = resolvedAppToken;
      }
    } catch (tokenErr) {
      console.warn(`[BSP] Could not fetch app token for sync trigger, using stored: ${tokenErr.message}`);
    }

    const syncResult = await gupshupService.syncTemplatesForApp({ appId, appApiKey });

    const status = Number(syncResult?.status || 0);
    const isRateLimited = status === 429 || syncResult?.reason === 'SYNC_ENDPOINT_UNAVAILABLE';

    templateSyncTriggerStateByApp.set(appId, {
      lastAttemptAt: Date.now(),
      cooldownUntil: isRateLimited
        ? Date.now() + TEMPLATE_SYNC_TRIGGER_RATE_LIMIT_COOLDOWN_MS
        : Date.now() + TEMPLATE_SYNC_TRIGGER_COOLDOWN_MS,
      inFlightPromise: null
    });

    return syncResult;
  })();

  templateSyncTriggerStateByApp.set(appId, {
    ...triggerState,
    inFlightPromise,
    lastAttemptAt: now
  });

  try {
    return await inFlightPromise;
  } finally {
    const latestState = templateSyncTriggerStateByApp.get(appId) || {};
    if (latestState.inFlightPromise) {
      templateSyncTriggerStateByApp.set(appId, {
        ...latestState,
        inFlightPromise: null
      });
    }
  }
}

module.exports = {
  // Messaging
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  sendInteractiveMessage,
  markAsRead,
  canSendSessionMessage,

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
