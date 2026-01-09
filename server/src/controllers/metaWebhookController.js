const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Workspace = require('../models/Workspace');
const WebhookLog = require('../models/WebhookLog');
const Template = require('../models/Template');
const { getIO } = require('../utils/socket');
const metaService = require('../services/metaService');
const { triggerWorkflows } = require('../services/workflowExecutionService');
const { checkAutoReply, sendAutoReply } = require('../services/autoReplyService');
const { matchFAQ } = require('../services/answerbotService');

// Verify webhook (GET)
function verify(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // Use global verify token from env (or could check per workspace)
  const verifyToken = process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
  
  if (mode && token === verifyToken) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }
  
  console.log('Webhook verification failed');
  return res.sendStatus(403);
}

// Handler for incoming webhook events (POST)
async function handler(req, res) {
  const body = req.body;
  const signatureHeader = req.headers['x-hub-signature-256'];
  
  try {
    // Verify signature if app secret is configured
    const appSecret = process.env.META_APP_SECRET;
    if (appSecret && signatureHeader) {
      const rawBody = JSON.stringify(body);
      const isValid = metaService.verifyWebhookSignature(rawBody, signatureHeader, appSecret);
      
      if (!isValid) {
        console.error('Webhook signature verification failed');
        // ✅ FIX: Only log failed signature as unverified, don't mark processed
        await WebhookLog.create({
          payload: body,
          verified: false,
          signatureHeader,
          error: 'Signature verification failed',
          processed: false // ✅ Mark as not processed for failed validation
        });
        return res.sendStatus(403);
      }
    }
    
    // Respond quickly to Meta
    res.sendStatus(200);
    
    // Process webhook asynchronously
    if (body.object === 'whatsapp_business_account') {
      await processWhatsAppWebhook(body, signatureHeader);
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
    // Still return 200 to Meta to avoid retries on our bugs
    if (!res.headersSent) {
      res.sendStatus(200);
    }
  }
}

// Process WhatsApp webhook payload
async function processWhatsAppWebhook(body, signatureHeader) {
  if (!body.entry) return;
  
  for (const entry of body.entry) {
    if (!entry.changes) continue;
    
    for (const change of entry.changes) {
      const value = change.value;
      
      // Get phone_number_id to map to workspace
      const phoneNumberId = value.metadata?.phone_number_id;
      
      // Find workspace by phone_number_id
      let workspace = null;
      if (phoneNumberId) {
        const workspaceDoc = await Workspace.findOne({ whatsappPhoneNumberId: phoneNumberId });
        workspace = workspaceDoc?._id || null;
      }
      
      // Log webhook
      let eventType = 'unknown';
      if (value.messages) eventType = 'message';
      else if (value.statuses) eventType = 'status';
      else if (value.template) eventType = 'template_status';
      else if (value.account_update) eventType = 'account_update';
      else if (value.business_capability_update) eventType = 'business_capability_update';
      
      // ✅ IDEMPOTENCY: Check if webhook already processed using x-hub-delivery header
      const deliveryId = body.entry?.[0]?.id || signatureHeader;
      if (deliveryId) {
        const existingLog = await WebhookLog.findOne({ 
          deliveryId: deliveryId,
          eventType: eventType
        });
        
        if (existingLog) {
          console.log(`[Webhook] ⏭️ Skipping duplicate webhook (delivery: ${deliveryId}, type: ${eventType})`);
          continue; // Skip if already processed
        }
      }
      
      // ✅ FIX: Create log and process, then mark as processed only if successful
      let webhookLog = null;
      try {
        webhookLog = await WebhookLog.create({
          deliveryId: deliveryId, // ✅ Store delivery ID for idempotency
          workspace,
          payload: body,
          verified: true,
          signatureHeader,
          eventType,
          processed: false
        });
      } catch (logErr) {
        console.error(`[Webhook] Error creating log for ${eventType}:`, logErr.message);
      }
      
      try {
        // Process messages
        if (value.messages) {
          await processInboundMessages(value.messages, workspace, value.contacts);
        }
        
        // Process status updates
        if (value.statuses) {
          await processStatusUpdates(value.statuses, workspace);
        }
        
        // ✅ Handle critical account events
        if (value.account_update) {
          await handleAccountUpdate(value.account_update, workspace);
        }
        
        // ✅ Handle business capability changes
        if (value.business_capability_update) {
          await handleBusinessCapabilityUpdate(value.business_capability_update, workspace);
        }
        
        // Process template status updates
        if (value.message_template_status_update) {
          await processTemplateStatusUpdate(value.message_template_status_update, workspace);
        }
        
        // ✅ Handle ads webhooks
        if (value.ad_review || value.ad_status_update || value.account_disabled) {
          await handleAdWebhook(value, workspace);
        }

        // ✅ Mark as processed only after successful processing
        if (webhookLog) {
          webhookLog.processed = true;
          webhookLog.processedAt = new Date();
          await webhookLog.save();
        }
      } catch (processErr) {
        console.error(`[Webhook] Error processing ${eventType}:`, processErr.message);
        if (webhookLog) {
          webhookLog.error = processErr.message;
          await webhookLog.save();
        }
      }
    }
  }
}

// Process inbound messages
async function processInboundMessages(messages, workspace, contactsInfo = []) {
  for (const msg of messages) {
    try {
      const from = msg.from; // phone number
      
      // Get or create contact
      let contact = await Contact.findOne({ phone: from, workspace });
      
      if (!contact) {
        const contactInfo = contactsInfo.find(c => c.wa_id === from);
        contact = await Contact.create({
          phone: from,
          name: contactInfo?.profile?.name || msg.profile?.name || 'Unknown',
          workspace: workspace || null
        });
      }
      
      // Get or create conversation
      let conversation = null;
      if (workspace) {
        conversation = await Conversation.findOne({ workspace, contact: contact._id });
        
        if (!conversation) {
          conversation = await Conversation.create({
            workspace,
            contact: contact._id,
            status: 'open',
            lastActivityAt: new Date()
          });
        }
        
        // Update conversation
        conversation.lastMessageAt = new Date();
        conversation.lastMessagePreview = msg.text?.body || `[${msg.type}]`;
        conversation.lastMessageDirection = 'inbound';
        conversation.lastActivityAt = new Date();
        conversation.unreadCount += 1;
        await conversation.save();
      }
      
      // Determine message type and body
      let messageType = msg.type || 'text';
      let messageBody = '';
      
      if (msg.text) {
        messageBody = msg.text.body;
      } else if (msg.image) {
        messageBody = msg.image.caption || '[Image]';
      } else if (msg.video) {
        messageBody = msg.video.caption || '[Video]';
      } else if (msg.document) {
        messageBody = msg.document.filename || '[Document]';
      } else if (msg.audio) {
        messageBody = '[Audio]';
      } else if (msg.voice) {
        messageBody = '[Voice]';
      }
      
      // Store message
      const message = await Message.create({
        workspace: workspace || null,
        contact: contact._id,
        direction: 'inbound',
        type: messageType,
        body: messageBody,
        status: 'received',
        meta: {
          whatsappId: msg.id,
          timestamp: msg.timestamp,
          raw: msg
        }
      });
      
      // ✅ CHECK AUTO-REPLIES FIRST (before workflows)
      // Auto-replies are evaluated before workflows and stop workflow execution if sent
      if (workspace && messageType === 'text' && messageBody) {
        try {
          const autoReplyCheck = await checkAutoReply(messageBody, contact, workspace);
          
          if (autoReplyCheck.shouldSend) {
            const sendResult = await sendAutoReply(
              autoReplyCheck.autoReplyData,
              contact,
              workspace,
              message
            );
            
            if (sendResult.success) {
              console.log(`[AutoReply] ✅ Sent auto-reply to ${contact.phone}`);
              
              // Mark message that auto-reply was sent
              message.meta.autoReplyId = autoReplyCheck.autoReplyId;
              message.meta.autoReplySent = true;
              await message.save();
              
              // Emit socket event
              try {
                getIO().to(`workspace:${workspace}`).emit('message.received', {
                  message,
                  contact,
                  conversation,
                  autoReplySent: true
                });
              } catch (socketErr) {
                console.error('Socket emit error:', socketErr.message);
              }
              
              // Return early - don't trigger workflows if auto-reply sent
              return;
            }
          }
        } catch (autoReplyErr) {
          console.error('[AutoReply] Error checking auto-reply:', autoReplyErr.message);
          // Continue to AnswerBot FAQ check if auto-reply fails
        }
        
        // ✅ CHECK ANSWERBOT FAQs (second priority, after auto-replies)
        try {
          const faqMatch = await matchFAQ(messageBody, workspace);
          
          if (faqMatch && faqMatch.answer) {
            console.log(`[AnswerBot] ✅ Found matching FAQ for message`);
            
            // Build and send FAQ answer as text message
            const faqMessage = await Message.create({
              workspace,
              contact: contact._id,
              direction: 'outbound',
              type: 'text',
              body: faqMatch.answer,
              status: 'sending'
            });
            
            try {
              const sendResult = await metaService.sendTextMessage(
                (await Workspace.findById(workspace)).whatsappAccessToken,
                (await Workspace.findById(workspace)).whatsappPhoneNumberId,
                contact.phone,
                faqMatch.answer
              );
              
              faqMessage.status = 'sent';
              faqMessage.sentAt = new Date();
              faqMessage.meta = {
                whatsappId: sendResult.messageId,
                faqId: faqMatch._id,
                answerBotReply: true
              };
              await faqMessage.save();
              
              // Mark the incoming message with FAQ info
              message.meta.faqId = faqMatch._id;
              message.meta.answerBotMatched = true;
              await message.save();
              
              // Emit socket event
              try {
                getIO().to(`workspace:${workspace}`).emit('message.received', {
                  message,
                  contact,
                  conversation,
                  answerBotReply: true
                });
              } catch (socketErr) {
                console.error('Socket emit error:', socketErr.message);
              }
              
              // Return early - don't trigger workflows if FAQ reply sent
              return;
            } catch (sendErr) {
              console.error('[AnswerBot] Error sending FAQ reply:', sendErr.message);
              // Continue to workflows if FAQ send fails
            }
          }
        } catch (faqErr) {
          console.error('[AnswerBot] Error checking FAQ:', faqErr.message);
          // Continue to workflows if FAQ check fails
        }
      }
      
      // ✅ TRIGGER WORKFLOWS on message received (only if no auto-reply or FAQ reply sent)
      if (workspace) {
        try {
          await triggerWorkflows('message_received', {
            messageId: message._id,
            contactId: contact._id,
            messageBody: messageBody,
            messageType: messageType
          }, workspace);
        } catch (workflowErr) {
          console.error('[Webhook] Error triggering workflows:', workflowErr.message);
        }
      }
      
      // Emit socket event
      try {
        if (workspace) {
          getIO().to(`workspace:${workspace}`).emit('message.received', {
            message,
            contact,
            conversation
          });
        }
      } catch (socketErr) {
        console.error('Socket emit error:', socketErr.message);
      }
    } catch (msgErr) {
      console.error('Error processing message:', msgErr);
    }
  }
}

// ✅ Process status updates + update campaign stats
async function processStatusUpdates(statuses, workspace) {
  const CampaignMessage = require('../models/CampaignMessage');
  const Campaign = require('../models/Campaign');
  
  for (const status of statuses) {
    try {
      const messageId = status.id;
      const newStatus = status.status; // 'sent', 'delivered', 'read', 'failed'
      
      const query = { 'meta.whatsappId': messageId };
      if (workspace) query.workspace = workspace;
      
      const message = await Message.findOne(query);
      
      if (message) {
        message.status = newStatus;
        if (!message.meta.statusUpdates) message.meta.statusUpdates = [];
        message.meta.statusUpdates.push({
          status: newStatus,
          timestamp: status.timestamp,
          ...status
        });
        
        // ✅ Update timestamp fields
        if (newStatus === 'sent' && !message.sentAt) {
          message.sentAt = new Date(status.timestamp * 1000);
        }
        if (newStatus === 'delivered' && !message.deliveredAt) {
          message.deliveredAt = new Date(status.timestamp * 1000);
        }
        if (newStatus === 'read' && !message.readAt) {
          message.readAt = new Date(status.timestamp * 1000);
        }
        
        await message.save();
        
        // ✅ Update CampaignMessage if this is a campaign message
        if (message.meta?.campaignMessageId) {
          const campaignMessage = await CampaignMessage.findByIdAndUpdate(
            message.meta.campaignMessageId,
            {
              status: newStatus,
              sentAt: newStatus === 'sent' ? new Date(status.timestamp * 1000) : undefined,
              deliveredAt: newStatus === 'delivered' ? new Date(status.timestamp * 1000) : undefined,
              readAt: newStatus === 'read' ? new Date(status.timestamp * 1000) : undefined,
              updatedAt: new Date()
            },
            { new: true }
          ).populate('campaign');
          
          // ✅ Update Campaign stats atomically
          if (campaignMessage && campaignMessage.campaign) {
            const campaign = campaignMessage.campaign;
            const updateOps = { updatedAt: new Date() };
            
            if (newStatus === 'delivered') {
              updateOps.$inc = updateOps.$inc || {};
              updateOps.$inc.deliveredCount = 1;
            }
            if (newStatus === 'read') {
              updateOps.$inc = updateOps.$inc || {};
              updateOps.$inc.readCount = 1;
            }
            
            await Campaign.findByIdAndUpdate(campaign._id, updateOps);
          }
        }
        
        // ✅ TRIGGER WORKFLOWS on status update
        if (workspace && message) {
          try {
            await triggerWorkflows('status_updated', {
              messageId: message._id,
              contactId: message.contact,
              status: newStatus
            }, workspace);
          } catch (workflowErr) {
            console.error('[Webhook] Error triggering workflows on status:', workflowErr.message);
          }
        }
        
        // Emit socket event
        try {
          if (workspace) {
            getIO().to(`workspace:${workspace}`).emit('message.status', {
              messageId: message._id,
              status: newStatus
            });
          }
        } catch (socketErr) {
          console.error('Socket emit error:', socketErr.message);
        }
      }
    } catch (statusErr) {
      console.error('Error processing status:', statusErr);
    }
  }
}

// Process template status updates
async function processTemplateStatusUpdate(templateUpdate, workspace) {
  try {
    const { event, message_template_name, message_template_language, reason } = templateUpdate;
    
    const query = {
      name: message_template_name,
      language: message_template_language
    };
    if (workspace) query.workspace = workspace;
    
    const template = await Template.findOne(query);
    
    if (template) {
      // Map event to status
      let newStatus = template.status;
      if (event === 'APPROVED') newStatus = 'APPROVED';
      else if (event === 'REJECTED') newStatus = 'REJECTED';
      else if (event === 'PENDING') newStatus = 'PENDING';
      else if (event === 'PAUSED') newStatus = 'PAUSED';
      else if (event === 'DISABLED') newStatus = 'DISABLED';
      
      template.status = newStatus;
      if (reason) template.rejectionReason = reason;
      if (newStatus === 'APPROVED' && !template.approvedAt) {
        template.approvedAt = new Date();
      }
      await template.save();
      
      console.log(`Template ${message_template_name} status updated to ${newStatus}`);
    }
  } catch (templateErr) {
    console.error('Error processing template update:', templateErr);
  }
}

// ✅ Handle Meta account-level updates
// Per Meta ESB documentation, this webhook captures PARTNER_ADDED event with customer's WABA and portfolio IDs
async function handleAccountUpdate(accountUpdate, workspace) {
  if (!workspace) {
    console.warn('[Webhook] Account update received but no workspace mapped');
    return;
  }
  
  try {
    const Workspace = require('../models/Workspace');
    const wsDoc = await Workspace.findById(workspace);
    
    if (!wsDoc) {
      console.warn(`[Webhook] Workspace ${workspace} not found for account update`);
      return;
    }
    
    // ✅ STEP 3 (Per Meta ESB docs): Capture customer asset IDs from PARTNER_ADDED webhook
    // This webhook contains the customer's WABA ID and business portfolio ID
    const { event, whatsapp_business_account_id, business_portfolio_id, account_status, decision_status } = accountUpdate;
    
    // Handle PARTNER_ADDED event - customer has completed ESB flow
    if (event === 'PARTNER_ADDED' && whatsapp_business_account_id && business_portfolio_id) {
      console.log('[Webhook] 📋 PARTNER_ADDED event received - ESB flow completed for workspace:', workspace);
      console.log('[Webhook] Customer WABA ID:', whatsapp_business_account_id);
      console.log('[Webhook] Customer Business Portfolio ID:', business_portfolio_id);
      
      // Store customer's asset IDs for later use in steps 4-6
      if (!wsDoc.esbFlow) wsDoc.esbFlow = {};
      wsDoc.esbFlow.customerWabaId = whatsapp_business_account_id;
      wsDoc.esbFlow.customerBusinessPortfolioId = business_portfolio_id;
      wsDoc.esbFlow.partnerAddedAt = new Date();
      wsDoc.esbFlow.partnerAddedWebhookReceived = true;
      
      console.log('[Webhook] ✅ Stored customer asset IDs for subsequent processing');
    }
    
    if (account_status) {
      // ✅ GAP 6: Validate account_status is a valid enum value
      const VALID_ACCOUNT_STATUSES = ['ACTIVE', 'DISABLED', 'PENDING_REVIEW'];
      if (!VALID_ACCOUNT_STATUSES.includes(account_status)) {
        console.warn(`[Webhook] Invalid account_status from Meta: ${account_status}. Expected one of: ${VALID_ACCOUNT_STATUSES.join(', ')}`);
        return;
      }

      console.log(`[Webhook] Account status update for workspace ${workspace}: ${account_status}`);
      
      // Mark ESB flow with account status
      if (!wsDoc.esbFlow) wsDoc.esbFlow = {};
      wsDoc.esbFlow.metaAccountStatus = account_status;
      wsDoc.esbFlow.metaAccountStatusUpdatedAt = new Date();
      
      // If account disabled, block messaging
      if (account_status === 'DISABLED' || account_status === 'PENDING_REVIEW') {
        wsDoc.esbFlow.accountBlocked = true;
        wsDoc.esbFlow.accountBlockedReason = account_status;
        console.warn(`[Webhook] ⚠️ Account ${account_status} - blocking messaging for workspace ${workspace}`);
      } else if (account_status === 'ACTIVE') {
        wsDoc.esbFlow.accountBlocked = false;
        wsDoc.esbFlow.accountBlockedReason = null;
      }
      
      await wsDoc.save();
    }
    
    if (decision_status) {
      // ✅ GAP 6: Validate decision_status is a valid enum value
      const VALID_DECISION_STATUSES = ['APPROVED', 'REJECTED', 'UNDER_REVIEW'];
      if (!VALID_DECISION_STATUSES.includes(decision_status)) {
        console.warn(`[Webhook] Invalid decision_status from Meta: ${decision_status}`);
        return;
      }

      console.log(`[Webhook] Account decision status: ${decision_status} for workspace ${workspace}`);
      wsDoc.esbFlow.metaDecisionStatus = decision_status;
      await wsDoc.save();
    }
  } catch (err) {
    console.error(`[Webhook] Error handling account update for workspace ${workspace}:`, err.message);
  }
}

// ✅ Handle Meta business capability updates
async function handleBusinessCapabilityUpdate(capabilityUpdate, workspace) {
  if (!workspace) {
    console.warn('[Webhook] Business capability update received but no workspace mapped');
    return;
  }
  
  try {
    const Workspace = require('../models/Workspace');
    const wsDoc = await Workspace.findById(workspace);
    
    if (!wsDoc) {
      console.warn(`[Webhook] Workspace ${workspace} not found for capability update`);
      return;
    }
    
    const { capability_status, capability_type, capability_action } = capabilityUpdate;
    
    // ✅ GAP 6: Validate capability_status is a valid enum value
    const VALID_CAPABILITY_STATUSES = ['APPROVED', 'GRANTED', 'REVOKED', 'PENDING'];
    if (capability_status && !VALID_CAPABILITY_STATUSES.includes(capability_status)) {
      console.warn(`[Webhook] Invalid capability_status from Meta: ${capability_status}. Expected one of: ${VALID_CAPABILITY_STATUSES.join(', ')}`);
      return;
    }

    // ✅ GAP 6: Validate capability_type is a valid enum value
    const VALID_CAPABILITY_TYPES = ['MESSAGING', 'PHONE_NUMBER_MANAGEMENT', 'CUSTOMER_DATA_PLATFORM', 'WEBHOOKS'];
    if (capability_type && !VALID_CAPABILITY_TYPES.includes(capability_type)) {
      console.warn(`[Webhook] Invalid capability_type from Meta: ${capability_type}. Expected one of: ${VALID_CAPABILITY_TYPES.join(', ')}`);
      return;
    }

    console.log(`[Webhook] Capability update for workspace ${workspace}: ${capability_type} = ${capability_status}`);
    
    if (!wsDoc.esbFlow) wsDoc.esbFlow = {};
    
    // Track capability changes
    if (!wsDoc.esbFlow.metaCapabilities) {
      wsDoc.esbFlow.metaCapabilities = {};
    }
    
    wsDoc.esbFlow.metaCapabilities[capability_type] = {
      status: capability_status,
      action: capability_action,
      updatedAt: new Date()
    };
    
    // Block messaging if key capabilities are revoked
    const criticalCapabilities = ['MESSAGING', 'PHONE_NUMBER_MANAGEMENT'];
    if (criticalCapabilities.includes(capability_type) && capability_status === 'REVOKED') {
      wsDoc.esbFlow.capabilityBlocked = true;
      wsDoc.esbFlow.capabilityBlockedReason = `${capability_type} revoked`;
      console.warn(`[Webhook] ⚠️ Critical capability ${capability_type} revoked - blocking workspace ${workspace}`);
    }
    
    await wsDoc.save();
  } catch (err) {
    console.error(`[Webhook] Error handling capability update for workspace ${workspace}:`, err.message);
  }
}

/**
 * ✅ Handle ads webhooks (ad_review, ad_status_update, ad_rejection)
 */
async function handleAdWebhook(value, workspace) {
  if (!workspace) return;

  try {
    const WhatsAppAd = require('../models/WhatsAppAd');
    const metaAdsService = require('../services/metaAdsService');
    
    // ad_review webhook
    if (value.ad_review) {
      console.log('[Webhook] Ad review update:', value.ad_review);
      
      for (const review of value.ad_review) {
        const adId = review.ad_id;
        const status = review.status; // PENDING_REVIEW, APPROVED, REJECTED
        
        if (status === 'APPROVED') {
          await metaAdsService.updateAdStatus(adId, 'ACTIVE', review);
        } else if (status === 'REJECTED') {
          await metaAdsService.updateAdStatus(adId, 'REJECTED', review);
        }
      }
    }
    
    // ad_status_update webhook
    if (value.ad_status_update) {
      console.log('[Webhook] Ad status update:', value.ad_status_update);
      
      for (const update of value.ad_status_update) {
        const adId = update.ad_id;
        const status = update.status; // ACTIVE, PAUSED, DELETED
        
        await metaAdsService.updateAdStatus(adId, status, update);
      }
    }
    
    // account_disabled webhook (affects all ads)
    if (value.account_disabled) {
      console.warn('[Webhook] Account disabled - pausing all ads for workspace:', workspace);
      
      const WhatsAppAd = require('../models/WhatsAppAd');
      const activeAds = await WhatsAppAd.find({
        workspace: workspace,
        status: 'active'
      });

      for (const ad of activeAds) {
        ad.status = 'paused';
        ad.pausedReason = 'ACCOUNT_BLOCKED';
        ad.pausedAt = new Date();
        await ad.save();
      }

      // Mark workspace as blocked
      const wsDoc = await Workspace.findById(workspace);
      if (wsDoc) {
        wsDoc.esbFlow.accountBlocked = true;
        wsDoc.esbFlow.accountBlockedReason = 'Account disabled by Meta';
        await wsDoc.save();
      }
    }
  } catch (err) {
    console.error('[Webhook] Error handling ad webhook:', err.message);
  }
}

module.exports = { verify, handler };
