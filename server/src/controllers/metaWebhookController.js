const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Workspace = require('../models/Workspace');
const WebhookLog = require('../models/WebhookLog');
const Template = require('../models/Template');
const { getIO } = require('../utils/socket');
const metaService = require('../services/metaService');
const bspMessagingService = require('../services/bspMessagingService');
const bspConfig = require('../config/bspConfig');
const { getWorkspaceByPhoneId, extractPhoneNumberId, routeTemplateWebhook } = require('../middlewares/bspTenantRouter');
const { triggerWorkflows } = require('../services/workflowExecutionService');
const { checkAutoReply, sendAutoReply } = require('../services/autoReplyService');
const { matchFAQ } = require('../services/answerbotService');

/**
 * ═══════════════════════════════════════════════════════════════════
 * BSP WEBHOOK HANDLER
 * 
 * Single webhook endpoint for all tenants.
 * Routes incoming webhooks to the correct workspace by phone_number_id.
 * ═══════════════════════════════════════════════════════════════════
 */

// Verify webhook (GET) - Single verification for all tenants
function verify(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // Use BSP config verify token (centralized)
  const verifyToken = bspConfig.webhookVerifyToken || process.env.META_VERIFY_TOKEN;
  
  if (mode && token === verifyToken) {
    console.log('[BSP Webhook] ✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  
  console.log('[BSP Webhook] ❌ Webhook verification failed');
  return res.sendStatus(403);
}

// Handler for incoming webhook events (POST)
async function handler(req, res) {
  const body = req.body;
  const signatureHeader = req.headers['x-hub-signature-256'];
  
  try {
    // ═══════════════════════════════════════════════════════════════════
    // SIGNATURE VERIFICATION (Centralized BSP validation)
    // ═══════════════════════════════════════════════════════════════════
    
    if (bspConfig.appSecret && signatureHeader) {
      const rawBody = JSON.stringify(body);
      const isValid = bspMessagingService.verifyWebhookSignature(rawBody, signatureHeader);
      
      if (!isValid) {
        console.error('[BSP Webhook] ❌ Signature verification failed');
        await WebhookLog.create({
          payload: body,
          verified: false,
          signatureHeader,
          error: 'Signature verification failed',
          processed: false,
          bspRouted: false
        });
        return res.sendStatus(403);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // RESPOND QUICKLY TO META (< 50ms required)
    // ═══════════════════════════════════════════════════════════════════
    res.sendStatus(200);
    
    // ═══════════════════════════════════════════════════════════════════
    // ROUTE TO CORRECT TENANT & PROCESS
    // ═══════════════════════════════════════════════════════════════════
    
    if (body.object === 'whatsapp_business_account') {
      try {
        const { enqueueWebhook } = require('../services/webhookQueue');
        await enqueueWebhook(body, signatureHeader);
        console.log('[BSP Webhook] ✅ Queued for async processing');
      } catch (queueErr) {
        console.error('[BSP Webhook] Queue failed, falling back to sync:', queueErr.message);
        processWhatsAppWebhook(body, signatureHeader).catch(err => {
          console.error('[BSP Webhook] Sync processing failed:', err.message);
        });
      }
    }
  } catch (err) {
    console.error('[BSP Webhook] Processing error:', err);
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
      
      // ═══════════════════════════════════════════════════════════════════
      // BSP TENANT ROUTING - Route by phone_number_id
      // ═══════════════════════════════════════════════════════════════════
      
      const phoneNumberId = extractPhoneNumberId(body);
      
      // Get workspace for this phone_number_id (BSP model)
      let workspace = null;
      let workspaceDoc = null;
      
      if (phoneNumberId) {
        workspaceDoc = await getWorkspaceByPhoneId(phoneNumberId);
        workspace = workspaceDoc?._id || null;
        
        if (workspaceDoc) {
          console.log(`[BSP Webhook] 📍 Routed to workspace: ${workspaceDoc.name} (phone: ${phoneNumberId})`);
        } else {
          console.warn(`[BSP Webhook] ⚠️ No workspace for phone_number_id: ${phoneNumberId}`);
        }
      }
      
      // Determine event type
      let eventType = 'unknown';
      if (value.messages) eventType = 'message';
      else if (value.statuses) eventType = 'status';
      else if (value.message_template_status_update) eventType = 'template_status';
      else if (value.account_update) eventType = 'account_update';
      else if (value.business_capability_update) eventType = 'business_capability_update';
      
      // ═══════════════════════════════════════════════════════════════════
      // IDEMPOTENCY CHECK
      // ═══════════════════════════════════════════════════════════════════
      
      const deliveryId = body.entry?.[0]?.id || signatureHeader;
      if (deliveryId) {
        const existingLog = await WebhookLog.findOne({ 
          deliveryId: deliveryId,
          eventType: eventType
        });
        
        if (existingLog) {
          console.log(`[BSP Webhook] ⏭️ Skipping duplicate (delivery: ${deliveryId}, type: ${eventType})`);
          continue;
        }
      }
      
      // Create webhook log
      let webhookLog = null;
      try {
        webhookLog = await WebhookLog.create({
          deliveryId: deliveryId,
          workspace,
          phoneNumberId, // BSP: Log the phone_number_id for tracking
          payload: body,
          verified: true,
          signatureHeader,
          eventType,
          processed: false,
          bspRouted: !!workspaceDoc // Track if BSP routing was successful
        });
      } catch (logErr) {
        console.error(`[BSP Webhook] Error creating log: ${logErr.message}`);
      }
      
      try {
        // Process messages (routed to specific workspace)
        if (value.messages) {
          await processInboundMessages(value.messages, workspace, value.contacts, workspaceDoc);
        }
        
        // Process status updates
        if (value.statuses) {
          await processStatusUpdates(value.statuses, workspace, workspaceDoc);
        }
        
        // Handle account-level events (BSP-wide)
        if (value.account_update) {
          await handleAccountUpdate(value.account_update, workspace, workspaceDoc);
        }
        
        // Handle capability changes
        if (value.business_capability_update) {
          await handleBusinessCapabilityUpdate(value.business_capability_update, workspace, workspaceDoc);
        }
        
        // Process template status (route by template name prefix)
        if (value.message_template_status_update) {
          await processTemplateStatusUpdate(value.message_template_status_update, workspace, workspaceDoc);
        }
        
        // Handle ads webhooks
        if (value.ad_review || value.ad_status_update || value.account_disabled) {
          await handleAdWebhook(value, workspace);
        }

        // Mark as processed
        if (webhookLog) {
          webhookLog.processed = true;
          webhookLog.processedAt = new Date();
          await webhookLog.save();
        }
      } catch (processErr) {
        console.error(`[BSP Webhook] Error processing ${eventType}:`, processErr.message);
        if (webhookLog) {
          webhookLog.error = processErr.message;
          await webhookLog.save();
        }
      }
    }
  }
}

// Process inbound messages
async function processInboundMessages(messages, workspace, contactsInfo = [], workspaceDoc = null) {
  const { checkAndHandleOptOut } = require('../services/optOutService');
  const { log } = require('../services/auditService');

  for (const msg of messages) {
    try {
      const from = msg.from; // phone number
      
      // Get or create contact (scoped to workspace for tenant isolation)
      let contact = await Contact.findOne({ phone: from, workspace });
      
      if (!contact) {
        const contactInfo = contactsInfo.find(c => c.wa_id === from);
        contact = await Contact.create({
          phone: from,
          name: contactInfo?.profile?.name || msg.profile?.name || 'Unknown',
          workspace: workspace || null
        });
      }
      
      // Extract message body
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
      
      // Handle opt-out/opt-in keywords (BSP model - use centralized service)
      if (workspaceDoc && workspaceDoc.isBspConnected() && messageBody) {
        const optOutResult = await checkAndHandleOptOut(contact, messageBody, workspaceDoc, workspace);
        if (optOutResult.optedOut || optOutResult.optedIn) {
          await log(workspace, null, optOutResult.optedOut ? 'contact.opted_out' : 'contact.opted_in', {
            type: 'contact',
            id: contact._id,
            phone: contact.phone,
            via: 'inbound_message'
          }, null, null);
          
          const message = await Message.create({
            workspace: workspace || null,
            contact: contact._id,
            direction: 'inbound',
            type: 'system',
            body: optOutResult.optedOut ? 'Contact opted out' : 'Contact opted back in',
            status: 'received',
            meta: {
              isOptOutMessage: true,
              optOutAction: optOutResult.optedOut ? 'out' : 'in',
              bspProcessed: true
            }
          });
          continue;
        }
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
        conversation.lastMessagePreview = messageBody;
        conversation.lastMessageDirection = 'inbound';
        conversation.lastActivityAt = new Date();
        conversation.unreadCount += 1;
        await conversation.save();
      }
      
      // Determine message type
      let messageType = msg.type || 'text';
      
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
            
            // Build and send FAQ answer using BSP messaging service
            const faqMessage = await Message.create({
              workspace,
              contact: contact._id,
              direction: 'outbound',
              type: 'text',
              body: faqMatch.answer,
              status: 'sending'
            });
            
            try {
              // Use BSP messaging service for centralized sending
              const sendResult = await bspMessagingService.sendTextMessage(
                workspace,
                contact.phone,
                faqMatch.answer,
                { contactId: contact._id }
              );
              
              faqMessage.status = 'sent';
              faqMessage.sentAt = new Date();
              faqMessage.meta = {
                whatsappId: sendResult.messageId,
                faqId: faqMatch._id,
                answerBotReply: true,
                bspSent: true
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
              faqMessage.status = 'failed';
              faqMessage.meta = { error: sendErr.message };
              await faqMessage.save();
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

// Process template status updates (BSP model - route by template name prefix)
async function processTemplateStatusUpdate(templateUpdate, workspace, workspaceDoc = null) {
  try {
    const { 
      event, 
      message_template_id,
      message_template_name, 
      message_template_language, 
      reason 
    } = templateUpdate;
    
    // ═══════════════════════════════════════════════════════════════════
    // BSP TEMPLATE ROUTING
    // Templates are namespaced: {workspaceIdSuffix}_{templateName}
    // We need to route to the correct workspace
    // ═══════════════════════════════════════════════════════════════════
    
    let targetWorkspace = workspace;
    
    // If no workspace from phone_number_id, try to route by template name
    if (!targetWorkspace && message_template_name) {
      const routedWorkspace = await routeTemplateWebhook(message_template_name);
      if (routedWorkspace) {
        targetWorkspace = routedWorkspace._id;
        console.log(`[BSP Webhook] 📍 Routed template update to workspace: ${routedWorkspace.name}`);
      }
    }
    
    // Extract original template name (remove namespace prefix)
    let originalTemplateName = message_template_name;
    if (message_template_name && message_template_name.includes('_')) {
      const parts = message_template_name.split('_');
      originalTemplateName = parts.slice(1).join('_'); // Remove the workspace prefix
    }
    
    // Build query to find the template
    const query = {
      language: message_template_language
    };
    
    // Search by Meta ID, namespaced name, or original name
    if (targetWorkspace) {
      query.workspace = targetWorkspace;
      query.$or = [
        { metaTemplateId: message_template_id },
        { metaTemplateName: message_template_name },
        { name: originalTemplateName }
      ];
    } else {
      query.$or = [
        { metaTemplateId: message_template_id },
        { metaTemplateName: message_template_name },
        { name: message_template_name }
      ];
    }
    
    const template = await Template.findOne(query);
    
    if (template) {
      // Store previous status for history
      const previousStatus = template.status;
      
      // Map event to status
      const statusMap = {
        'APPROVED': 'APPROVED',
        'REJECTED': 'REJECTED',
        'PENDING': 'PENDING',
        'PENDING_DELETION': 'PENDING',
        'DELETED': 'DELETED',
        'DISABLED': 'DISABLED',
        'REINSTATED': 'APPROVED',
        'FLAGGED': 'DISABLED',
        'PAUSED': 'PAUSED'
      };
      
      const newStatus = statusMap[event] || event;
      
      // Update template fields
      template.status = newStatus;
      template.metaTemplateId = message_template_id || template.metaTemplateId;
      template.metaTemplateName = message_template_name;
      template.lastWebhookUpdate = new Date();
      
      if (reason) {
        template.rejectionReason = reason;
      }
      
      // Add to approval history if status changed
      if (previousStatus !== newStatus) {
        template.approvalHistory = template.approvalHistory || [];
        template.approvalHistory.push({
          status: newStatus,
          timestamp: new Date(),
          reason: reason,
          source: 'WEBHOOK'
        });
      }
      
      // Set approved timestamp
      if (newStatus === 'APPROVED' && !template.approvedAt) {
        template.approvedAt = new Date();
      }
      
      await template.save();
      
      console.log(`[BSP Webhook] Template ${message_template_name} status: ${previousStatus} → ${newStatus}`);
      
      // Emit socket event to workspace
      const emitWorkspace = targetWorkspace || template.workspace;
      if (emitWorkspace) {
        try {
          getIO().to(`workspace:${emitWorkspace}`).emit('template.status', {
            templateId: template._id,
            metaTemplateId: message_template_id,
            templateName: originalTemplateName,
            status: newStatus,
            previousStatus,
            reason,
            timestamp: new Date()
          });
        } catch (socketErr) {
          console.error('Socket emit error:', socketErr.message);
        }
      }
      
      return { success: true, templateId: template._id, newStatus };
    } else {
      console.warn(`[BSP Webhook] Template not found: ${message_template_name} (ID: ${message_template_id})`);
      return { success: false, reason: 'Template not found' };
    }
  } catch (templateErr) {
    console.error('[BSP Webhook] Error processing template update:', templateErr);
    return { success: false, error: templateErr.message };
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
