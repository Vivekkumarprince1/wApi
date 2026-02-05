/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEMPLATE SENDING SERVICE (INTERAKT-STYLE)
 * 
 * Multi-tenant safe template messaging service for WhatsApp BSP architecture.
 * 
 * This service handles:
 * 1. Template validation (ownership, approval status)
 * 2. Dynamic variable injection ({{1}}, {{2}} → parameters)
 * 3. Meta API payload construction
 * 4. Message sending via parent WABA
 * 5. Conversation logging (for billing/analytics)
 * 
 * Architecture:
 * - All templates submitted under parent WABA with namespaced names
 * - Each workspace has unique phone_number_id
 * - Parent system user token used for all API calls
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');
const bspConfig = require('../config/bspConfig');
const Template = require('../models/Template');
const Workspace = require('../models/Workspace');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const bspMessagingService = require('./bspMessagingService');
const { isOptedOutByPhone, isOptedOut } = require('./optOutService');
const billingLedgerService = require('./billingLedgerService');
const { enforceWorkspaceBilling } = require('./billingEnforcementService');

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const VARIABLE_PATTERN = /\{\{(\d+)\}\}/g;

const CONVERSATION_CATEGORIES = {
  MARKETING: 'marketing_conversation',
  UTILITY: 'utility_conversation',
  AUTHENTICATION: 'authentication_conversation',
  SERVICE: 'service_conversation' // For user-initiated replies
};

const ERROR_CODES = {
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_NOT_APPROVED: 'TEMPLATE_NOT_APPROVED',
  TEMPLATE_OWNERSHIP_MISMATCH: 'TEMPLATE_OWNERSHIP_MISMATCH',
  VARIABLE_COUNT_MISMATCH: 'VARIABLE_COUNT_MISMATCH',
  MISSING_REQUIRED_VARIABLES: 'MISSING_REQUIRED_VARIABLES',
  WORKSPACE_NOT_CONFIGURED: 'WORKSPACE_NOT_CONFIGURED',
  PHONE_NOT_CONFIGURED: 'PHONE_NOT_CONFIGURED',
  META_API_ERROR: 'META_API_ERROR',
  INVALID_RECIPIENT: 'INVALID_RECIPIENT',
  BILLING_TRIAL_NO_SEND: 'BILLING_TRIAL_NO_SEND',
  BILLING_PAST_DUE: 'BILLING_PAST_DUE',
  BILLING_SUSPENDED: 'BILLING_SUSPENDED'
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEMPLATE SENDING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send a template message to a recipient
 * 
 * This is the PRIMARY function for sending templates. It:
 * 1. Validates template ownership and approval
 * 2. Builds Meta API payload with variables
 * 3. Sends via parent system user token
 * 4. Logs the conversation for billing
 * 
 * @param {Object} params
 * @param {string} params.workspaceId - Workspace ID (for ownership validation)
 * @param {string} params.templateId - Template MongoDB ID (preferred) OR
 * @param {string} params.templateName - Template name (will lookup in workspace)
 * @param {string} params.to - Recipient phone number (E.164 format: 919876543210)
 * @param {Object} params.variables - Variable values: { header: [], body: [], buttons: [] }
 * @param {string} params.contactId - Optional contact ID for linking
 * @param {Object} params.meta - Additional metadata (campaignId, etc.)
 * @returns {Object} { success, messageId, conversationId, template, recipient }
 */
async function sendTemplate(params) {
  const {
    workspaceId,
    templateId,
    templateName,
    to,
    variables = {},
    contactId,
    meta = {}
  } = params;

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: Validate recipient
  // ─────────────────────────────────────────────────────────────────────────────
  const normalizedPhone = normalizePhoneNumber(to);
  if (!normalizedPhone) {
    throw createError(ERROR_CODES.INVALID_RECIPIENT, 'Invalid phone number format');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: Get workspace and validate BSP configuration
  // ─────────────────────────────────────────────────────────────────────────────
  const workspace = await bspMessagingService.getWorkspaceForMessaging(workspaceId);

    await enforceWorkspaceBilling(workspaceId);

  // Compliance: enforce opt-out BEFORE any outbound send (Interakt requirement)
  // WHY: Meta policy requires honoring STOP across all outbound channels
  if (contactId) {
    const optedOut = await isOptedOut(contactId);
    if (optedOut) {
      throw createError(ERROR_CODES.INVALID_RECIPIENT, 'Recipient has opted out');
    }
  } else {
    const optedOut = await isOptedOutByPhone(workspaceId, normalizedPhone);
    if (optedOut) {
      throw createError(ERROR_CODES.INVALID_RECIPIENT, 'Recipient has opted out');
    }
  }

  const phoneNumberId = workspace.bspPhoneNumberId || workspace.whatsappPhoneNumberId;
  if (!phoneNumberId) {
    throw createError(ERROR_CODES.PHONE_NOT_CONFIGURED, 'WhatsApp phone number not configured for this workspace');
  }

  // BSP billing enforcement (hard gate)
  try {
    await enforceWorkspaceBilling(workspaceId);
  } catch (billingError) {
    throw createError(billingError.code || 'BILLING_BLOCKED', billingError.message || 'Billing blocked');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3: Get and validate template
  // ─────────────────────────────────────────────────────────────────────────────
  const template = await getAndValidateTemplate(workspaceId, templateId, templateName);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4: Build Meta API payload with variables
  // ─────────────────────────────────────────────────────────────────────────────
  const { payload, validationResult } = buildTemplatePayload(template, normalizedPhone, variables);
  
  if (!validationResult.valid) {
    throw createError(
      ERROR_CODES.VARIABLE_COUNT_MISMATCH,
      `Variable validation failed: ${validationResult.errors.join(', ')}`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5: Send via Meta API
  // ─────────────────────────────────────────────────────────────────────────────
  const url = `${bspConfig.baseUrl}/${phoneNumberId}/messages`;
  
  let response;
  try {
    // Use BSP service for all outbound Meta API calls (centralized token + safety)
    response = await bspMessagingService.makeMetaApiCall('POST', url, payload);
  } catch (apiError) {
    // Log failed attempt
    await logTemplateSend({
      workspaceId,
      template,
      recipient: normalizedPhone,
      contactId,
      status: 'failed',
      error: apiError.message,
      meta
    });
    
    throw createError(ERROR_CODES.META_API_ERROR, apiError.message, apiError);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6: Log successful send
  // ─────────────────────────────────────────────────────────────────────────────
  const contact = await resolveContactForSend(workspaceId, contactId, normalizedPhone);
  const conversation = await getOrCreateConversation(workspaceId, contact?._id, template, meta);

  const messageLog = await logTemplateSend({
    workspaceId,
    template,
    recipient: normalizedPhone,
    contactId,
    status: 'sent',
    whatsappMessageId: response.messages?.[0]?.id,
    meta: {
      ...meta,
      conversationId: conversation?._id
    }
  });

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 8: Usage ledger for conversation billing
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      await billingLedgerService.startBusinessConversation({
        workspaceId,
        conversationId: conversation?._id || null,
        contactId: contact?._id,
        phoneNumber: normalizedPhone,
        templateId: template._id,
        templateName: template.name,
        templateCategory: template.category,
        source: meta?.campaignId ? 'CAMPAIGN' : 'INBOX',
        messageId: messageLog?._id,
        whatsappMessageId: response.messages?.[0]?.id,
        isBillable: true
      });
    } catch (ledgerErr) {
      console.error('[TemplateSending] Billing ledger update failed:', ledgerErr.message);
    }

  if (conversation && contact) {
    await billingLedgerService.startBusinessConversation({
      workspaceId,
      conversationId: conversation._id,
      contactId: contact._id,
      phoneNumber: normalizedPhone,
      templateId: template._id,
      templateName: template.name,
      templateCategory: template.category,
      source: meta.source || 'API',
      campaignId: meta.campaignId,
      campaignName: meta.campaignName,
      userId: meta.sentBy,
      messageId: messageLog._id,
      whatsappMessageId: response.messages?.[0]?.id,
      isBillable: true
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 7: Update workspace usage
  // ─────────────────────────────────────────────────────────────────────────────
  await updateWorkspaceUsage(workspace, template.category);

  return {
    success: true,
    messageId: response.messages?.[0]?.id,
    conversationId: messageLog._id,
    template: {
      id: template._id,
      name: template.name,
      category: template.category,
      language: template.language
    },
    recipient: normalizedPhone,
    sentAt: new Date()
  };
}

/**
 * Send template to multiple recipients (bulk)
 * 
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.templateId
 * @param {Array} params.recipients - Array of { to, variables, contactId }
 * @param {Object} params.meta
 * @returns {Object} { success, total, sent, failed, results }
 */
async function sendTemplateBulk(params) {
  const { workspaceId, templateId, templateName, recipients, meta = {} } = params;

  // Validate template once for all recipients
  const template = await getAndValidateTemplate(workspaceId, templateId, templateName);
  
  const results = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const result = await sendTemplate({
        workspaceId,
        templateId: template._id,
        to: recipient.to,
        variables: recipient.variables || {},
        contactId: recipient.contactId,
        meta: { ...meta, bulkSend: true }
      });
      
      results.push({
        to: recipient.to,
        success: true,
        messageId: result.messageId
      });
      sent++;
    } catch (error) {
      results.push({
        to: recipient.to,
        success: false,
        error: error.message
      });
      failed++;
    }

    // Rate limiting: 80 messages per second max (Meta limit)
    await sleep(15);
  }

  return {
    success: failed === 0,
    total: recipients.length,
    sent,
    failed,
    results
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get and validate template for sending
 * 
 * @param {string} workspaceId
 * @param {string} templateId - MongoDB ID (preferred)
 * @param {string} templateName - Template name (fallback lookup)
 * @returns {Object} Validated template document
 */
async function getAndValidateTemplate(workspaceId, templateId, templateName) {
  let template;

  if (templateId) {
    template = await Template.findById(templateId);
  } else if (templateName) {
    template = await Template.findOne({
      workspace: workspaceId,
      name: templateName.toLowerCase()
    });
  }

  if (!template) {
    throw createError(
      ERROR_CODES.TEMPLATE_NOT_FOUND,
      `Template not found: ${templateId || templateName}`
    );
  }

  // Verify ownership
  if (template.workspace.toString() !== workspaceId.toString()) {
    throw createError(
      ERROR_CODES.TEMPLATE_OWNERSHIP_MISMATCH,
      'Template does not belong to this workspace'
    );
  }

  // Verify approval status
  if (template.status !== 'APPROVED') {
    const statusMessages = {
      DRAFT: 'Template has not been submitted for approval',
      PENDING: 'Template is pending approval from Meta',
      REJECTED: `Template was rejected: ${template.rejectionReason || 'Unknown reason'}`,
      PAUSED: 'Template has been paused',
      DISABLED: 'Template has been disabled by Meta',
      IN_APPEAL: 'Template is under appeal review'
    };

    throw createError(
      ERROR_CODES.TEMPLATE_NOT_APPROVED,
      statusMessages[template.status] || `Template status: ${template.status}`
    );
  }

  return template;
}

/**
 * Validate variable values against template requirements
 * 
 * @param {Object} template
 * @param {Object} variables - { header: [], body: [], buttons: [] }
 * @returns {Object} { valid, errors, warnings }
 */
function validateVariables(template, variables = {}) {
  const errors = [];
  const warnings = [];

  // Count required variables in each component
  const headerVars = countVariables(template.header?.text);
  const bodyVars = countVariables(template.body?.text);
  const buttonVars = template.buttons?.items?.reduce((count, btn) => {
    if (btn.type === 'URL' && btn.urlSuffix) return count + 1;
    if (btn.type === 'COPY_CODE') return count + 1;
    return count;
  }, 0) || 0;

  // Validate header variables
  if (headerVars > 0) {
    const provided = variables.header?.length || 0;
    if (provided < headerVars) {
      errors.push(`Header requires ${headerVars} variable(s), got ${provided}`);
    }
  }

  // Validate body variables
  if (bodyVars > 0) {
    const provided = variables.body?.length || 0;
    if (provided < bodyVars) {
      errors.push(`Body requires ${bodyVars} variable(s), got ${provided}`);
    }
  }

  // Validate button variables
  if (buttonVars > 0) {
    const provided = variables.buttons?.length || 0;
    if (provided < buttonVars) {
      errors.push(`Buttons require ${buttonVars} variable(s), got ${provided}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    required: { header: headerVars, body: bodyVars, buttons: buttonVars }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYLOAD BUILDING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build Meta API template payload
 * 
 * Converts stored template + variables into Meta's required format:
 * {
 *   messaging_product: "whatsapp",
 *   to: "919876543210",
 *   type: "template",
 *   template: {
 *     name: "order_update",
 *     language: { code: "en" },
 *     components: [...]
 *   }
 * }
 * 
 * @param {Object} template - Template document
 * @param {string} to - Recipient phone
 * @param {Object} variables - { header: [], body: [], buttons: [] }
 * @returns {Object} { payload, validationResult }
 */
function buildTemplatePayload(template, to, variables = {}) {
  // Validate variables first
  const validationResult = validateVariables(template, variables);

  const components = [];

  // ─────────────────────────────────────────────────────────────────────────────
  // HEADER COMPONENT
  // ─────────────────────────────────────────────────────────────────────────────
  if (template.header?.enabled && template.header?.format !== 'NONE') {
    const headerComponent = { type: 'header' };

    if (template.header.format === 'TEXT') {
      // Text header with variables
      const headerVarCount = countVariables(template.header.text);
      if (headerVarCount > 0 && variables.header?.length > 0) {
        headerComponent.parameters = variables.header.map(value => ({
          type: 'text',
          text: String(value)
        }));
      }
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.header.format)) {
      // Media header
      headerComponent.parameters = [{
        type: template.header.format.toLowerCase(),
        [template.header.format.toLowerCase()]: {
          link: variables.headerMedia || template.header.mediaUrl
        }
      }];
    }

    if (headerComponent.parameters?.length > 0) {
      components.push(headerComponent);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BODY COMPONENT
  // ─────────────────────────────────────────────────────────────────────────────
  const bodyVarCount = countVariables(template.body?.text);
  if (bodyVarCount > 0 && variables.body?.length > 0) {
    components.push({
      type: 'body',
      parameters: variables.body.map(value => ({
        type: 'text',
        text: String(value)
      }))
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BUTTON COMPONENT
  // ─────────────────────────────────────────────────────────────────────────────
  if (template.buttons?.enabled && template.buttons?.items?.length > 0) {
    let buttonIndex = 0;
    let varIndex = 0;

    template.buttons.items.forEach((button, idx) => {
      if (button.type === 'URL' && button.urlSuffix) {
        // Dynamic URL button
        components.push({
          type: 'button',
          sub_type: 'url',
          index: idx,
          parameters: [{
            type: 'text',
            text: variables.buttons?.[varIndex] || button.example || ''
          }]
        });
        varIndex++;
      } else if (button.type === 'COPY_CODE') {
        // Copy code button (OTP)
        components.push({
          type: 'button',
          sub_type: 'copy_code',
          index: idx,
          parameters: [{
            type: 'coupon_code',
            coupon_code: variables.buttons?.[varIndex] || variables.otp || ''
          }]
        });
        varIndex++;
      }
    });
  }

  // Build final payload
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'template',
    template: {
      name: template.metaTemplateName || template.name,
      language: { code: template.language || 'en' }
    }
  };

  // Only add components if we have any
  if (components.length > 0) {
    payload.template.components = components;
  }

  return { payload, validationResult };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log template send for billing and analytics
 * 
 * Uses the enhanced Message model with template-specific fields
 * 
 * @param {Object} params
 * @returns {Object} Message document
 */
async function logTemplateSend(params) {
  const {
    workspaceId,
    template,
    recipient,
    variables,
    contactId,
    status,
    whatsappMessageId,
    error,
    meta = {}
  } = params;

  // Find or create contact
  let contact = null;
  if (contactId) {
    contact = await Contact.findById(contactId);
  } else {
    contact = await Contact.findOne({
      workspace: workspaceId,
      phone: recipient
    });
  }

  // Build message document with enhanced template fields
  const message = new Message({
    workspace: workspaceId,
    contact: contact?._id,
    conversation: meta.conversationId || undefined,
    sentBy: meta.sentBy || undefined,
    direction: 'outbound',
    type: 'template',
    body: template.body?.text,
    status: status,
    sentAt: status === 'sent' ? new Date() : null,
    failedAt: status === 'failed' ? new Date() : null,
    failureReason: error,
    
    // WhatsApp identifiers
    whatsappMessageId: whatsappMessageId,
    recipientPhone: recipient,
    
    // Template-specific fields (new structure)
    template: {
      id: template._id,
      name: template.name,
      metaTemplateName: template.metaTemplateName,
      category: template.category,
      language: template.language,
      variables: variables || {}
    },
    
    // Conversation billing fields
    conversationBilling: {
      category: CONVERSATION_CATEGORIES[template.category] || 'utility_conversation',
      isNewConversation: false // Will be updated by webhook if needed
    },
    
    // Campaign tracking
    campaign: meta.campaignId ? {
      id: meta.campaignId,
      batchId: meta.batchId
    } : undefined,
    
    // Additional metadata
    meta: {
      ...meta,
      bulkSend: meta.bulkSend || false
    }
  });

  await message.save();
  return message;
}

/**
 * Update workspace usage counters
 * 
 * @param {Object} workspace
 * @param {string} category - MARKETING, UTILITY, AUTHENTICATION
 */
async function updateWorkspaceUsage(workspace, category) {
  const updatePath = `bspUsage.templates.${category.toLowerCase()}`;
  
  await Workspace.findByIdAndUpdate(workspace._id, {
    $inc: {
      'bspUsage.totalMessages': 1,
      'bspUsage.templates.total': 1,
      [updatePath]: 1
    },
    $set: {
      'bspUsage.lastMessageAt': new Date()
    }
  });
}

// Resolve contact for outbound template send
async function resolveContactForSend(workspaceId, contactId, recipientPhone) {
  if (contactId) {
    return Contact.findById(contactId);
  }

  let contact = await Contact.findOne({ workspace: workspaceId, phone: recipientPhone });
  if (!contact) {
    contact = await Contact.create({
      workspace: workspaceId,
      phone: recipientPhone,
      name: 'Unknown'
    });
  }

  return contact;
}

// Create or reuse a conversation for outbound template sends
async function getOrCreateConversation(workspaceId, contactId, template, meta = {}) {
  if (!contactId) return null;

  let conversation = await Conversation.findOne({ workspace: workspaceId, contact: contactId });

  if (!conversation) {
    conversation = await Conversation.create({
      workspace: workspaceId,
      contact: contactId,
      status: 'open',
      conversationType: 'business_initiated',
      conversationStartedAt: new Date(),
      lastActivityAt: new Date(),
      lastMessageAt: new Date(),
      lastMessageType: 'template',
      lastMessageDirection: 'outbound',
      lastMessagePreview: template?.body?.text || template?.bodyText || template?.name
    });
  }

  return conversation;
}

// ═══════════════════════════════════════════════════════════════════════════════
// META API HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Make authenticated Meta API call using BSP system token
 */
async function makeMetaApiCall(method, url, data = null) {
  const token = bspConfig.systemUserToken;
  
  if (!token) {
    throw new Error('BSP system user token not configured');
  }

  try {
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    const metaError = error.response?.data?.error;
    if (metaError) {
      const errorMessage = `Meta API Error [${metaError.code}]: ${metaError.message}`;
      const enhancedError = new Error(errorMessage);
      enhancedError.metaError = metaError;
      enhancedError.statusCode = error.response?.status;
      throw enhancedError;
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Count variables in text ({{1}}, {{2}}, etc.)
 */
function countVariables(text) {
  if (!text) return 0;
  const matches = text.match(VARIABLE_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * Extract variable numbers from text
 */
function extractVariableNumbers(text) {
  if (!text) return [];
  const numbers = [];
  let match;
  while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
    numbers.push(parseInt(match[1], 10));
  }
  return numbers.sort((a, b) => a - b);
}

/**
 * Normalize phone number to E.164 format without +
 */
function normalizePhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digits
  let normalized = phone.replace(/\D/g, '');
  
  // Handle common formats
  if (normalized.startsWith('0')) {
    // Local format, assume India (+91)
    normalized = '91' + normalized.slice(1);
  }
  
  // Validate length (minimum 10 digits)
  if (normalized.length < 10) return null;
  
  return normalized;
}

/**
 * Create standardized error
 */
function createError(code, message, originalError = null) {
  const error = new Error(message);
  error.code = code;
  error.originalError = originalError;
  return error;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE INFO HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get template info for frontend preview
 */
async function getTemplateInfo(workspaceId, templateId) {
  const template = await Template.findOne({
    _id: templateId,
    workspace: workspaceId
  });

  if (!template) return null;

  return {
    id: template._id,
    name: template.name,
    displayName: template.displayName,
    category: template.category,
    language: template.language,
    status: template.status,
    canSend: template.status === 'APPROVED',
    variables: {
      header: countVariables(template.header?.text),
      body: countVariables(template.body?.text),
      buttons: template.buttons?.items?.filter(b => 
        b.type === 'URL' && b.urlSuffix || b.type === 'COPY_CODE'
      ).length || 0
    },
    preview: {
      header: template.header?.enabled ? {
        format: template.header.format,
        text: template.header.text,
        mediaUrl: template.header.mediaUrl
      } : null,
      body: template.body?.text,
      footer: template.footer?.enabled ? template.footer.text : null,
      buttons: template.buttons?.enabled ? template.buttons.items : []
    }
  };
}

/**
 * List sendable templates for a workspace
 */
async function listSendableTemplates(workspaceId, options = {}) {
  const { category, search, page = 1, limit = 50 } = options;

  const query = {
    workspace: workspaceId,
    status: 'APPROVED'
  };

  if (category) {
    query.category = category.toUpperCase();
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { displayName: { $regex: search, $options: 'i' } }
    ];
  }

  const [templates, total] = await Promise.all([
    Template.find(query)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('name displayName category language status body header footer buttons')
      .lean(),
    Template.countDocuments(query)
  ]);

  return {
    templates: templates.map(t => ({
      id: t._id,
      name: t.name,
      displayName: t.displayName,
      category: t.category,
      language: t.language,
      variables: {
        header: countVariables(t.header?.text),
        body: countVariables(t.body?.text)
      },
      preview: t.body?.text?.substring(0, 100)
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Main sending functions
  sendTemplate,
  sendTemplateBulk,
  
  // Validation
  getAndValidateTemplate,
  validateVariables,
  
  // Payload building
  buildTemplatePayload,
  
  // Logging
  logTemplateSend,
  
  // Info helpers
  getTemplateInfo,
  listSendableTemplates,
  
  // Utilities
  normalizePhoneNumber,
  countVariables,
  extractVariableNumbers,
  
  // Constants
  ERROR_CODES,
  CONVERSATION_CATEGORIES
};
