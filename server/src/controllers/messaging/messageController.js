const { Message, Contact, Template, Workspace, Conversation } = require('../../models');
const whatsappService = require('../../services/bsp/bspMessagingService');
const bspMessagingService = require('../../services/bsp/bspMessagingService');
const bspConfig = require('../../config/bspConfig');
const { enqueueRetry } = require('../../services/infrastructure/messageRetryQueue');
const billingLedgerService = require('../../services/billing/billingLedgerService');
const { isMediaHandle } = require('../../utils/mediaUtils');
const mongoose = require('mongoose');
const inboxSocketService = require('../../services/messaging/inboxSocketService');

function normalizePhoneNumber(phone, defaultCountryCode = '91') {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `${defaultCountryCode}${digits.slice(1)}`;
  return digits;
}

function getWorkspacePartnerAppId(workspace) {
  return String(
    workspace?.gupshupIdentity?.partnerAppId ||
    workspace?.gupshupAppId ||
    ''
  ).trim() || null;
}

function validateTemplateForCurrentApp(template, workspace) {
  const currentPartnerAppId = getWorkspacePartnerAppId(workspace);

  if (!currentPartnerAppId || !template?.partnerAppId) {
    return null;
  }

  if (String(template.partnerAppId).trim() !== currentPartnerAppId) {
    return {
      message: 'This template belongs to a previous WhatsApp connection and cannot be sent from the current connected number. Please resync or recreate the template for the active Gupshup app.',
      code: 'TEMPLATE_APP_MISMATCH',
      currentPartnerAppId,
      templatePartnerAppId: String(template.partnerAppId).trim()
    };
  }

  return null;
}

async function resolveOutboundContact(workspaceId, payload = {}) {
  const rawContactId = payload.contactId || payload.id || payload.contact?._id || payload.contact?.id;
  const rawPhone = payload.phone || payload.to || payload.contact?.phone;
  const contactName = payload.name || payload.contact?.name || 'Unknown';

  if (rawContactId && mongoose.Types.ObjectId.isValid(rawContactId)) {
    const byId = await Contact.findOne({ _id: rawContactId, workspace: workspaceId });
    if (byId) return byId;
  }

  const normalizedPhone = normalizePhoneNumber(rawPhone);
  if (!normalizedPhone) return null;

  const byPhone = await Contact.findOne({
    workspace: workspaceId,
    phone: { $in: [normalizedPhone, `+${normalizedPhone}`] }
  });

  if (byPhone) return byPhone;

  try {
    return await Contact.create({
      workspace: workspaceId,
      phone: normalizedPhone,
      name: contactName
    });
  } catch (err) {
    if (err?.code === 11000) {
      return Contact.findOne({
        workspace: workspaceId,
        phone: { $in: [normalizedPhone, `+${normalizedPhone}`] }
      });
    }
    throw err;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * BSP MESSAGE CONTROLLER
 * 
 * All outbound messaging goes through the centralized BSP service.
 * No per-workspace tokens - everything uses the parent WABA system token.
 * ═══════════════════════════════════════════════════════════════════
 */

// Send a message (queues it for sending)
async function sendMessage(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { body } = req.body;

    if (!body || !String(body).trim()) {
      return res.status(400).json({ message: 'Message body is required' });
    }

    const contact = await resolveOutboundContact(workspaceId, req.body);
    if (!contact) {
      return res.status(400).json({ message: 'Valid contactId or phone is required' });
    }
    
    // Check if we can send a session message
    const canSend = await bspMessagingService.canSendSessionMessage(workspaceId, contact.phone);
    if (!canSend) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot send text message outside 24-hour window. Use a template instead.' 
      });
    }

    // Get or create conversation (although should exist if canSend is true)
    let conversation = await Conversation.findOne({ workspace: workspaceId, contact: contact._id });
    if (!conversation) {
      const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      conversation = await Conversation.create({
        workspace: workspaceId,
        contact: contact._id,
        status: 'open',
        channel: 'whatsapp', // Match webhook handler
        conversationType: 'business_initiated',
        conversationStartedAt: new Date(),
        lastActivityAt: new Date(),
        lastMessageAt: new Date(),
        lastInboundAt: null,
        lastMessageType: 'text',
        lastMessageDirection: 'outbound',
        lastMessagePreview: body.substring(0, 50),
        isOpen: true,
        windowExpiresAt: windowExpiresAt // CRITICAL: Track 24h window
      });
    } else {
      conversation.lastActivityAt = new Date();
      conversation.lastMessageAt = new Date();
      conversation.lastMessagePreview = body.substring(0, 50);
      conversation.lastMessageDirection = 'outbound';
      conversation.lastMessageType = 'text';
      // Refresh window on outbound message (if window expired)
      if (!conversation.windowExpiresAt || new Date(conversation.windowExpiresAt) <= new Date()) {
        conversation.windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
      await conversation.save();
    }

    // Send via BSP service
    const result = await bspMessagingService.sendTextMessage(
      workspaceId,
      contact.phone,
      body,
      {
        contactId: contact._id,
        conversationId: conversation._id,
        sentBy: req.user._id
      }
    );

    res.status(200).json({ success: true, message: 'Message sent', result });
  } catch (err) { next(err); }
}

// Webhook endpoint to receive messages or status updates from WhatsApp Cloud
async function webhookHandler(req, res, next) {
  try {
    // WhatsApp sends a specific envelope. We parse minimal fields for demo.
    const data = req.body;
    // Example: parse inbound message and create Message record
    // NOTE: Real WhatsApp webhook format needs robust parsing per docs.
    if (data.entry) {
      // iterate entries
      for (const entry of data.entry) {
        // push to processing pipeline; simplified here
        // TODO: implement proper parsing based on WhatsApp payload
      }
    }
    res.sendStatus(200);
  } catch (err) { next(err); }
}

module.exports = { sendMessage, webhookHandler };

// Send a WhatsApp template message immediately (BSP Model)
async function sendTemplateMessage(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId, templateId, variables = {}, language = 'en', headerMediaUrl = '' } = req.body;

    if (!contactId || !templateId) {
      console.log("[MessageController] 400 ERROR: Missing required fields");
      console.log("[MessageController] Request Body:", JSON.stringify(req.body, null, 2));
      console.log("[MessageController] User Workspace:", workspaceId);

      return res.status(400).json({
        message: "contactId and templateId are required",
        received: req.body
      });
    }

    const contact = await Contact.findOne({ _id: contactId, workspace: workspaceId });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    console.log(`[MessageController] Contact found:`, JSON.stringify(contact, null, 2));
    console.log(`[MessageController] Contact phone: "${contact.phone}"`);

    const template = await Template.findOne({ _id: templateId, workspace: workspaceId });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    if (template.status !== 'APPROVED') {
      console.log("400 ERROR IN MSG CONTROLLER:", "TRIGGERED"); return res.status(400).json({ message: 'Template must be approved before sending' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    // ═══════════════════════════════════════════════════════════════════
    // BSP VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    if (!workspace.bspManaged) {
      console.log("400 ERROR IN MSG CONTROLLER:", "TRIGGERED"); return res.status(400).json({
        message: 'Workspace is not configured for WhatsApp. Please complete onboarding.',
        code: 'BSP_NOT_CONFIGURED'
      });
    }

    if (!workspace.bspPhoneNumberId) {
      console.log("400 ERROR IN MSG CONTROLLER:", "TRIGGERED"); return res.status(400).json({
        message: 'No WhatsApp phone number assigned to this workspace',
        code: 'BSP_PHONE_NOT_ASSIGNED'
      });
    }

    const templateAppMismatch = validateTemplateForCurrentApp(template, workspace);
    if (templateAppMismatch) {
      return res.status(409).json({
        success: false,
        ...templateAppMismatch
      });
    }

    // Build components array for Meta API
    const components = buildTemplateComponents(template, variables, { headerMediaUrl });

    console.log(`[MessageController] Template components built:`, JSON.stringify(components, null, 2));
    console.log(`[MessageController] Template object:`, JSON.stringify(template, null, 2));
    console.log(`[MessageController] Variables:`, JSON.stringify(variables, null, 2));

    // V3 template sends use template name + components.
    const providerTemplateId = template.metaTemplateId || template.providerId || null;
    const metaTemplateName = template.metaTemplateName || template.name;

    // ═══════════════════════════════════════════════════════════════════
    // WALLET VALIDATION (Hardened Compliance)
    // ═══════════════════════════════════════════════════════════════════
    try {
      await billingLedgerService.ensureWalletBalance(workspaceId, template.category);
    } catch (walletErr) {
      if (walletErr.code === 'INSUFFICIENT_BALANCE') {
        return res.status(402).json({
          success: false,
          message: walletErr.message,
          code: 'INSUFFICIENT_WALLET_BALANCE',
          details: walletErr.details
        });
      }
      throw walletErr;
    }

    // Get or create conversation first to link message
    const { conversation, isNew: isNewConversation } = await getOrCreateConversation(workspaceId, contact._id, template);

    // Create a queued message record for tracking
    const message = await Message.create({
      workspace: workspaceId,
      contact: contact._id,
      conversation: conversation?._id || undefined,
      recipientPhone: contact.phone,
      direction: 'outbound',
      type: 'template',
      body: renderTemplatePreview(template, variables),
      status: 'queued', // Store as queued initially, update via webhook
      template: {
        id: template._id,
        name: template.name,
        metaTemplateName: metaTemplateName,
        category: template.category,
        language,
        variables
      },
      meta: {
        templateId: template._id,
        templateName: template.name,
        metaTemplateName: metaTemplateName,
        variables,
        language,
        components,
        bspSent: true
      }
    });

    console.log(`[MessageController] Sending template ${metaTemplateName} to ${contact.phone}`);

    try {
      // ═══════════════════════════════════════════════════════════════════
      // SEND VIA BSP MESSAGING SERVICE (Centralized)
      // ═══════════════════════════════════════════════════════════════════

      const result = await bspMessagingService.sendTemplateMessage(
        workspaceId,
        contact.phone,
        metaTemplateName,
        language,
        components,
        { contactId: contact._id, skipMessageLog: true, conversationId: conversation?._id, headerMediaUrl }
      );

      console.log(`[MessageController] Template sent successfully: ${result.messageId}`);

      // Keep as queued until provider webhooks confirm sent/delivered/read
      message.status = 'queued';
      message.meta.whatsappId = result.messageId;
      message.meta.whatsappResponses = [result];
      message.meta.providerAcceptedAt = new Date();
      message.markModified('meta');
      await message.save();

      try {
        await billingLedgerService.startBusinessConversation({
          workspaceId,
          conversationId: conversation?._id || null,
          contactId: contact._id,
          phoneNumber: contact.phone,
          templateId: template._id,
          templateName: template.name,
          templateCategory: template.category,
          source: 'API',
          messageId: message._id,
          whatsappMessageId: result.messageId,
          isBillable: true
        });
      } catch (ledgerErr) {
        console.error('[MessageController] Billing ledger update failed:', ledgerErr.message);
      }

      // Emit socket event so frontend sees conversation immediately
      try {
        const conversationWithContact = await Conversation.findById(conversation?._id).populate('contact', 'name phone profilePicture');
        if (conversationWithContact && conversationWithContact.contact) {
          if (isNewConversation) {
            await inboxSocketService.emitNewConversation(workspaceId, conversationWithContact, conversationWithContact.contact, message);
            console.log(`[MessageController] ✅ Socket event emitted: NEW conversation with template`);
          } else {
            await inboxSocketService.emitNewMessage(workspaceId, conversationWithContact, message, conversationWithContact.contact);
            console.log(`[MessageController] ✅ Socket event emitted: NEW message in existing conversation`);
          }
        }
      } catch (socketErr) {
        console.error('[MessageController] Socket event emission failed:', socketErr.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Template message accepted by provider and queued for delivery tracking',
        id: message._id,
        whatsappId: result.messageId
      });
    } catch (err) {
      console.error(`[MessageController] FAILED to send template: ${err.message}`);
      message.status = 'failed';
      message.meta.errors = [err.message];
      if (err.response?.data) {
        message.meta.rawError = err.response.data;
      }
      message.markModified('meta');
      await message.save();

      // Handle specific BSP errors
      if (err.message.includes('BSP_RATE_LIMIT_EXCEEDED')) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded. Please slow down.',
          code: 'RATE_LIMIT_EXCEEDED',
          id: message._id
        });
      }

      if (err.message.includes('BSP_DAILY_LIMIT_EXCEEDED')) {
        return res.status(429).json({
          success: false,
          message: 'Daily message limit reached for your plan.',
          code: 'DAILY_LIMIT_EXCEEDED',
          id: message._id
        });
      }

      // Handle WABA access issues
      if (err.message.includes('does not exist') ||
        err.message.includes('cannot be loaded due to missing permissions')) {
        return res.status(503).json({
          success: false,
          message: 'WhatsApp Business Account is not properly configured.',
          code: 'BSP_WABA_ACCESS_ERROR',
          id: message._id
        });
      }

      // Enqueue for retry
      try {
        await enqueueRetry({
          _id: message._id,
          workspaceId,
          recipientPhone: contact.phone,
          templateId: template._id,
          messageBody: renderTemplatePreview(template, variables),
          timestamp: new Date(),
        }, err.message, 0);

        return res.status(202).json({
          success: false,
          message: 'Message send failed, queued for retry',
          id: message._id,
          error: err.message,
          status: 'retry_queued',
        });
      } catch (retryErr) {
        console.error('[MessageController] Failed to enqueue retry:', retryErr.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to send template message',
          error: err.message
        });
      }
    }
  } catch (err) {
    next(err);
  }
}

// Send bulk template messages to multiple contacts (BSP Model)
async function sendBulkTemplateMessage(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactIds, templateId, language = 'en', variablesMap = {} } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      console.log("400 ERROR IN MSG CONTROLLER:", "TRIGGERED"); return res.status(400).json({ message: 'contactIds array is required' });
    }

    if (!templateId) {
      console.log("400 ERROR IN MSG CONTROLLER:", "TRIGGERED"); return res.status(400).json({ message: 'templateId is required' });
    }

    const template = await Template.findOne({ _id: templateId, workspace: workspaceId });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    if (template.status !== 'APPROVED') {
      console.log("400 ERROR IN MSG CONTROLLER:", "TRIGGERED"); return res.status(400).json({ message: 'Template must be approved before sending' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    // ═══════════════════════════════════════════════════════════════════
    // BSP VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    if (!workspace.bspManaged) {
      console.log("400 ERROR IN MSG CONTROLLER:", "TRIGGERED"); return res.status(400).json({
        message: 'Workspace is not configured for WhatsApp',
        code: 'BSP_NOT_CONFIGURED'
      });
    }

    if (!workspace.bspPhoneNumberId) {
      console.log("400 ERROR IN MSG CONTROLLER:", "TRIGGERED"); return res.status(400).json({
        message: 'No WhatsApp phone number assigned',
        code: 'BSP_PHONE_NOT_ASSIGNED'
      });
    }

    const templateAppMismatch = validateTemplateForCurrentApp(template, workspace);
    if (templateAppMismatch) {
      return res.status(409).json({
        success: false,
        ...templateAppMismatch
      });
    }

    // Pre-check daily/monthly limits
    const plan = workspace.plan || 'free';
    const dailyLimit = workspace.bspRateLimits?.dailyMessageLimit ||
      bspConfig.getRateLimit(plan, 'dailyMessageLimit');
    const monthlyLimit = workspace.bspRateLimits?.monthlyMessageLimit ||
      bspConfig.getRateLimit(plan, 'monthlyMessageLimit');

    const currentDaily = workspace.bspUsage?.messagesToday || 0;
    const currentMonthly = workspace.bspUsage?.messagesThisMonth || 0;

    if (currentDaily + contactIds.length > dailyLimit) {
      return res.status(429).json({
        message: `Bulk send would exceed daily limit (${dailyLimit}). Current: ${currentDaily}, Requested: ${contactIds.length}`,
        code: 'DAILY_LIMIT_EXCEEDED',
        limit: dailyLimit,
        current: currentDaily,
        requested: contactIds.length
      });
    }

    if (currentMonthly + contactIds.length > monthlyLimit) {
      return res.status(429).json({
        message: `Bulk send would exceed monthly limit (${monthlyLimit})`,
        code: 'MONTHLY_LIMIT_EXCEEDED',
        limit: monthlyLimit,
        current: currentMonthly,
        requested: contactIds.length
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // WALLET VALIDATION (Bulk Pre-check)
    // ═══════════════════════════════════════════════════════════════════
    try {
      const { price, category } = await billingLedgerService.getTemplatePrice(workspaceId, template.category);
      if (price > 0) {
        const totalRequired = price * contactIds.length;
        const walletService = require('../../services/billing/walletService');
        const wallet = await walletService.getBalance(workspaceId);
        if ((wallet.balance || 0) < totalRequired) {
          return res.status(402).json({
            success: false,
            message: `Insufficient wallet balance for bulk send. Required: ${totalRequired} paise for ${contactIds.length} ${category} messages.`,
            code: 'INSUFFICIENT_WALLET_BALANCE',
            details: { required: totalRequired, available: wallet.balance, count: contactIds.length }
          });
        }
      }
    } catch (walletErr) {
      console.error('[MessageController] Bulk wallet pre-check failed:', walletErr.message);
      // If check fails technically, we might want to be safe and block or alert.
    }

    // Fetch all contacts
    const contacts = await Contact.find({
      _id: { $in: contactIds },
      workspace: workspaceId
    });

    if (contacts.length === 0) {
      return res.status(404).json({ message: 'No valid contacts found' });
    }

    // V3 template sends use template name + components.
    const providerTemplateId = template.metaTemplateId || template.providerId || null;
    const metaTemplateName = template.metaTemplateName || template.name;

    const results = {
      total: contacts.length,
      sent: 0,
      failed: 0,
      details: []
    };

    // Send to each contact via BSP service
    for (const contact of contacts) {
      try {
        // Get variables for this contact
        const variables = variablesMap[contact._id.toString()] || variablesMap.default || {};

        // Build components
        const components = buildTemplateComponents(template, variables);

        // Get or create conversation to ensure it shows in Inbox
        const { conversation, isNew: isNewConversation } = await getOrCreateConversation(workspaceId, contact._id, template);

        // Create message record
        const message = await Message.create({
          workspace: workspaceId,
          contact: contact._id,
          conversation: conversation?._id || undefined,
          direction: 'outbound',
          type: 'template',
          body: renderTemplatePreview(template, variables),
          status: 'queued',
          meta: {
            templateId: template._id,
            templateName: template.name,
            metaTemplateName: metaTemplateName,
            variables,
            language,
            bulk: true,
            bspSent: true
          }
        });

        // ═══════════════════════════════════════════════════════════════════
        // SEND VIA BSP MESSAGING SERVICE
        // ═══════════════════════════════════════════════════════════════════

        const result = await bspMessagingService.sendTemplateMessage(
          workspaceId,
          contact.phone,
          metaTemplateName,
          language,
          components,
          { contactId: contact._id, skipMessageLog: true, conversationId: conversation?._id }
        );

        // Keep as queued until webhook confirmation
        message.status = 'queued';
        message.meta.whatsappId = result.messageId;
        message.meta.providerAcceptedAt = new Date();
        message.markModified('meta');
        await message.save();

        // ═══════════════════════════════════════════════════════════════════
        // EMIT SOCKET EVENT FOR REAL-TIME INBOX UPDATE
        // ═══════════════════════════════════════════════════════════════════
        if (conversation && isNewConversation) {
          try {
            await inboxSocketService.emitNewConversation(workspaceId, conversation, contact, message);
            console.log(`[BulkSend] Emitted new conversation event for ${contact.phone}`);
          } catch (socketErr) {
            console.error('[BulkSend] Socket event emission failed:', socketErr.message);
          }
        }

        results.sent++;
        results.details.push({
          contactId: contact._id,
          phone: contact.phone,
          status: 'queued',
          messageId: message._id,
          whatsappId: result.messageId
        });

        // Small delay to avoid rate limiting (BSP service handles this too)
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        results.failed++;
        results.details.push({
          contactId: contact._id,
          phone: contact.phone,
          status: 'failed',
          error: error.message
        });

        // If rate limited, stop bulk send
        if (error.message.includes('BSP_RATE_LIMIT') || error.message.includes('DAILY_LIMIT') || error.message.includes('MONTHLY_LIMIT')) {
          results.details.push({
            status: 'stopped',
            reason: error.message,
            remainingContacts: contacts.length - results.sent - results.failed
          });
          break;
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Bulk send completed: ${results.sent} sent, ${results.failed} failed`,
      results
    });

  } catch (err) {
    next(err);
  }
}

// Helper function to build template components for Meta API
function buildTemplateComponents(template, variables, options = {}) {
  const components = [];
  const resolvedHeaderMediaUrl = String(options.headerMediaUrl || '').trim();

  // Version 1: Use components array (recommended format)
  if (template.components && template.components.length > 0) {
    // Find HEADER component
    const headerComponent = template.components?.find(c => c.type === 'HEADER');
    if (headerComponent && variables.header) {
      const headerType = headerComponent.format?.toLowerCase() || 'text';

      // Support for TEXT, IMAGE, DOCUMENT, VIDEO headers
      if (headerType === 'text') {
        components.push({
          type: 'header',
          parameters: Array.isArray(variables.header)
            ? variables.header.map(v => ({ type: 'text', text: v }))
            : [{ type: 'text', text: variables.header }]
        });
      } else if (['image', 'document', 'video'].includes(headerType)) {
        const mediaLink = resolvedHeaderMediaUrl || (Array.isArray(variables.header) ? variables.header[0] : variables.header) || template.header?.mediaUrl || '';

        if (mediaLink) {
          const isHandle = isMediaHandle(mediaLink);
          components.push({
            type: 'header',
            parameters: [{
              type: headerType,
              [headerType]: isHandle 
                ? { id: mediaLink } 
                : { link: mediaLink }
            }]
          });
        }
      }
    }

    // Find BODY component
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    if (bodyComponent && variables.body && variables.body.length > 0) {
      components.push({
        type: 'body',
        parameters: variables.body.map(v => ({ type: 'text', text: v }))
      });
    }

    // Find BUTTON components
    const buttonComponents = template.components?.filter(c => c.type === 'BUTTONS');
    if (buttonComponents && variables.buttons && variables.buttons.length > 0) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: variables.buttons.map(v => ({ type: 'text', text: v }))
      });
    }
  }
  // Version 2: Fallback to structured objects (legacy/interakt format)
  else {
    // Header params
    if (template.header?.enabled && variables.header) {
      const headerFormat = template.header.format || 'TEXT';

      if (headerFormat === 'TEXT') {
        components.push({
          type: 'header',
          parameters: Array.isArray(variables.header)
            ? variables.header.map(v => ({ type: 'text', text: v }))
            : [{ type: 'text', text: variables.header }]
        });
      } else if (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(headerFormat)) {
        const type = headerFormat.toLowerCase();
        const mediaLink = resolvedHeaderMediaUrl || (Array.isArray(variables.header) ? variables.header[0] : variables.header) || template.header?.mediaUrl || '';

        if (mediaLink) {
          const isHandle = isMediaHandle(mediaLink);
          components.push({
            type: 'header',
            parameters: [{
              type: type,
              [type]: isHandle 
                ? { id: mediaLink } 
                : { link: mediaLink }
            }]
          });
        }
      }
    }

    // Body params
    if (variables.body && variables.body.length > 0) {
      components.push({
        type: 'body',
        parameters: variables.body.map(v => ({ type: 'text', text: v }))
      });
    }

    // Button params
    if (template.buttons?.enabled && variables.buttons && variables.buttons.length > 0) {
      let varIndex = 0;
      template.buttons.items.forEach((btn, idx) => {
        if ((btn.type === 'URL' && btn.urlSuffix) || btn.type === 'COPY_CODE') {
          const btnVars = [];
          if (btn.variables && btn.variables.length > 0) {
             const numVars = btn.variables.length;
             btnVars.push(...variables.buttons.slice(varIndex, varIndex + numVars));
             varIndex += numVars;
          } else if (varIndex < variables.buttons.length) {
              btnVars.push(variables.buttons[varIndex]);
              varIndex += 1;
          }
  
          if (btnVars.length > 0) {
            components.push({
              type: 'button',
              sub_type: btn.type === 'COPY_CODE' ? 'copy_code' : 'url',
              index: idx,
              parameters: btnVars.map(v => ({ type: 'text', text: String(v) }))
            });
          }
        }
      });
    }
  }

  return components;
}

// Helper function to render template preview with variables
function renderTemplatePreview(template, variables) {
  let preview = '';

  // Get raw texts prioritizing structured body, then components, then flattened fields
  const headerComponent = template.components?.find(c => c.type === 'HEADER');
  let rawHeaderText = headerComponent?.text || template.header?.text || template.headerText || '';
  
  const bodyComponent = template.components?.find(c => c.type === 'BODY');
  let rawBodyText = bodyComponent?.text || template.body?.text || template.bodyText || template.preview || '';
  
  const footerComponent = template.components?.find(c => c.type === 'FOOTER');
  let rawFooterText = footerComponent?.text || template.footer?.text || template.footerText || '';

  // Add header
  if (rawHeaderText) {
    if (variables.header) {
      const headerVars = Array.isArray(variables.header) ? variables.header : [variables.header];
      headerVars.forEach((v, i) => {
        rawHeaderText = rawHeaderText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), v);
      });
    }
    preview += `${rawHeaderText}\n\n`;
  }

  // Add body
  if (rawBodyText) {
    if (variables.body && Array.isArray(variables.body)) {
      variables.body.forEach((v, i) => {
        rawBodyText = rawBodyText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), v);
      });
    }
    preview += rawBodyText;
  }

  // Add footer
  if (rawFooterText) {
    preview += `\n\n${rawFooterText}`;
  }

  return preview.trim() || 'Template message';
}

async function getOrCreateConversation(workspaceId, contactId, template) {
  if (!contactId) return { conversation: null, isNew: false };

  const workspace = await Workspace.findById(workspaceId).select('gupshupIdentity wabaId').lean();
  
  let conversation = await Conversation.findOne({ workspace: workspaceId, contact: contactId });
  let isNew = false;
  
  if (!conversation) {
    // Ensure 24h window is initialized for business-initiated sends
    const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    conversation = await Conversation.create({
      workspace: workspaceId,
      contact: contactId,
      status: 'open',
      channel: 'whatsapp', // Match webhook handler
      conversationType: 'business_initiated',
      conversationStartedAt: new Date(),
      lastActivityAt: new Date(),
      lastMessageAt: new Date(),
      lastInboundAt: null, // No inbound yet
      lastMessageType: 'template',
      lastMessageDirection: 'outbound',
      lastMessagePreview: template?.bodyText || template?.name,
      isOpen: true, // Match webhook handler
      windowExpiresAt: windowExpiresAt, // CRITICAL: Track 24h conversation window
      wabaId: workspace?.gupshupIdentity?.wabaId || workspace?.wabaId // Match webhook handler
    });
    isNew = true;
  } else {
    // If conversation exists, we MUST update it to be open and update lastActivityAt
    // so that it shows up in the inbox view.
    const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    conversation.status = 'open';
    conversation.isOpen = true;
    conversation.lastActivityAt = new Date();
    conversation.lastMessageAt = new Date();
    conversation.lastMessageType = 'template';
    conversation.lastMessageDirection = 'outbound';
    conversation.lastMessagePreview = template?.bodyText || template?.name;
    conversation.windowExpiresAt = windowExpiresAt;
    
    await conversation.save();
    isNew = false;
  }

  return { conversation, isNew };
}

module.exports.sendTemplateMessage = sendTemplateMessage;
module.exports.sendBulkTemplateMessage = sendBulkTemplateMessage;
