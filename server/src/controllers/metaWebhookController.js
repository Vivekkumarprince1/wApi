const Message = require('../models/Message');
const axios = require('axios');
const path = require('path');
const fs = require('fs/promises');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
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
const billingLedgerService = require('../services/billingLedgerService');
const { updateChildBusinessByPhoneNumberId } = require('../services/childBusinessService');

// Stage 4: Import inbox socket service for real-time updates
const inboxSocketService = require('../services/inboxSocketService');

// Stage 4 Hardening: Import SLA and auto-assignment services
const slaService = require('../services/slaService');
const autoAssignmentService = require('../services/autoAssignmentService');

const MEDIA_STORAGE_ROOT = path.resolve(__dirname, '..', '..', 'uploads', 'workspaces');

function getMediaExtension(mimeType = '') {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('image/jpeg')) return 'jpg';
  if (normalized.includes('image/png')) return 'png';
  if (normalized.includes('image/webp')) return 'webp';
  if (normalized.includes('video/mp4')) return 'mp4';
  if (normalized.includes('video/3gpp')) return '3gp';
  if (normalized.includes('audio/mpeg')) return 'mp3';
  if (normalized.includes('audio/ogg')) return 'ogg';
  if (normalized.includes('audio/wav')) return 'wav';
  if (normalized.includes('application/pdf')) return 'pdf';
  return 'bin';
}

async function storeMediaForTenant({ workspaceId, mediaInfo, media }) {
  if (!mediaInfo?.url || !workspaceId) return null;

  const ext = getMediaExtension(mediaInfo.mimeType || media?.mimeType);
  const fileName = `${media.id}.${ext}`;
  const tenantDir = path.join(MEDIA_STORAGE_ROOT, workspaceId.toString(), 'media');
  const filePath = path.join(tenantDir, fileName);
  const publicPath = `/uploads/workspaces/${workspaceId}/media/${fileName}`;

  try {
    await fs.mkdir(tenantDir, { recursive: true });
    await fs.access(filePath);
    return { path: publicPath, size: mediaInfo.fileSize || null };
  } catch {
    // File does not exist yet; download below
  }

  const systemToken = bspConfig.systemUserToken || process.env.META_ACCESS_TOKEN;
  const headers = systemToken ? { Authorization: `Bearer ${systemToken}` } : undefined;

  const response = await axios.get(mediaInfo.url, {
    responseType: 'arraybuffer',
    headers
  });

  await fs.writeFile(filePath, response.data);

  return {
    path: publicPath,
    size: mediaInfo.fileSize || response.data?.length || null
  };
}

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
    // Signature verification is handled once in middleware (webhookSecurity)
    if (!req.webhookVerified) {
      return res.sendStatus(403);
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
            // Store redacted payload to avoid PII persistence
            payload: redactWebhookPayload(body),
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

  if (!workspace || !workspaceDoc) {
    console.warn('[BSP Webhook] Skipping inbound messages - workspace not resolved');
    return;
  }

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
          workspace: workspace
        });
      }

      // Opt-in tracking (Interakt-style compliance)
      if (!contact.optIn?.status) {
        contact.optIn = {
          status: true,
          optedInAt: new Date(),
          optedInVia: 'inbound_message'
        };
        await contact.save();
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
            workspace: workspace,
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
      let isNewConversation = false;
      if (workspace) {
        conversation = await Conversation.findOne({ workspace, contact: contact._id });
        
        if (!conversation) {
          conversation = await Conversation.create({
            workspace,
            contact: contact._id,
            status: 'open',
            lastActivityAt: new Date(),
            lastCustomerMessageAt: new Date(), // Stage 4: Track for 24h window
            conversationType: 'customer_initiated', // Stage 4: Billing tracking
            conversationStartedAt: new Date()
          });
          isNewConversation = true;
          
          // HARDENING: Set SLA deadline for new conversations
          try {
            await slaService.setSlaDeadline(conversation._id, workspace);
          } catch (slaErr) {
            console.error('[Webhook] Error setting SLA deadline:', slaErr.message);
          }
          
          // HARDENING: Auto-assign if enabled
          try {
            await autoAssignmentService.autoAssignConversation(conversation._id, workspace);
          } catch (assignErr) {
            console.error('[Webhook] Error auto-assigning:', assignErr.message);
          }
        }
        
        // Update conversation with Stage 4 fields
        conversation.lastMessageAt = new Date();
        conversation.lastMessagePreview = messageBody;
        conversation.lastMessageDirection = 'inbound';
        conversation.lastMessageType = msg.type || 'text'; // Stage 4
        conversation.lastActivityAt = new Date();
        conversation.lastCustomerMessageAt = new Date(); // Stage 4: Track for 24h window
        
        // Stage 4: Use model method for per-agent unread tracking
        conversation.incrementUnreadForAllAgents();
        
        // Reopen if closed (customer sent new message)
        if (conversation.status === 'closed' || conversation.status === 'resolved') {
          conversation.status = 'open';
          conversation.statusChangedAt = new Date();
          // Reset 24h window
          conversation.conversationType = 'customer_initiated';
          conversation.conversationStartedAt = new Date();
          
          // HARDENING: Reset SLA deadline when conversation reopened
          try {
            await slaService.setSlaDeadline(conversation._id, workspace);
          } catch (slaErr) {
            console.error('[Webhook] Error resetting SLA deadline:', slaErr.message);
          }
        }
        
        await conversation.save();
      }
      
      // Determine message type
      let messageType = msg.type || 'text';

      // Extract inbound media metadata (if present)
      let media = null;
      if (msg.image) {
        media = {
          id: msg.image.id,
          mimeType: msg.image.mime_type,
          sha256: msg.image.sha256,
          caption: msg.image.caption
        };
      } else if (msg.video) {
        media = {
          id: msg.video.id,
          mimeType: msg.video.mime_type,
          sha256: msg.video.sha256,
          caption: msg.video.caption
        };
      } else if (msg.document) {
        media = {
          id: msg.document.id,
          mimeType: msg.document.mime_type,
          sha256: msg.document.sha256,
          filename: msg.document.filename
        };
      } else if (msg.audio) {
        media = {
          id: msg.audio.id,
          mimeType: msg.audio.mime_type,
          sha256: msg.audio.sha256
        };
      } else if (msg.voice) {
        media = {
          id: msg.voice.id,
          mimeType: msg.voice.mime_type,
          sha256: msg.voice.sha256
        };
      } else if (msg.sticker) {
        media = {
          id: msg.sticker.id,
          mimeType: msg.sticker.mime_type,
          sha256: msg.sticker.sha256
        };
      }

      // Resolve media URL via BSP API when possible (on-demand download)
      if (media?.id && workspaceDoc?.isBspConnected?.()) {
        try {
          const mediaInfo = await bspMessagingService.getMediaUrl(media.id);
          if (mediaInfo?.url) {
            media.url = mediaInfo.url;
            media.fileSize = mediaInfo.fileSize || media.fileSize;

            // Download and store per-tenant
            try {
              const stored = await storeMediaForTenant({
                workspaceId: workspace,
                mediaInfo,
                media
              });
              if (stored?.path) {
                media.url = stored.path;
                media.fileSize = stored.size || media.fileSize;
              }
            } catch (downloadErr) {
              console.error('[Webhook] Media download failed:', downloadErr.message);
            }
          }
        } catch (mediaErr) {
          console.error('[Webhook] Media URL resolve failed:', mediaErr.message);
        }
      }
      
      // Store message
      const message = await Message.create({
        workspace: workspace,
        conversation: conversation?._id || null,
        contact: contact._id,
        direction: 'inbound',
        type: messageType,
        body: messageBody,
        status: 'received',
        media: media || undefined,
        meta: {
          whatsappId: msg.id,
          timestamp: msg.timestamp,
          raw: msg
        }
      });

      // Billing ledger + usage tracking (Meta-aligned)
      try {
        await billingLedgerService.recordMessage({
          workspaceId: workspace,
          conversationId: conversation?._id || null,
          contactId: contact._id,
          direction: 'inbound',
          messageId: message._id,
          whatsappMessageId: msg.id
        });
      } catch (ledgerErr) {
        console.error('[Webhook] Billing ledger update failed:', ledgerErr.message);
      }

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
              
              // Stage 4: Emit inbox socket events
              try {
                // Emit new message event (using Stage 4 inbox socket service)
                await inboxSocketService.emitNewMessage(workspace, conversation, message, contact);
                
                // Also emit legacy event for backward compatibility
                getIO()?.to(`workspace:${workspace}`).emit('message.received', {
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
      
      // Stage 4: Emit inbox socket events for real-time updates
      try {
        if (workspace && conversation) {
          // Emit new message to inbox
          await inboxSocketService.emitNewMessage(workspace, conversation, message, contact);
          
          // If new conversation, emit that too
          if (isNewConversation) {
            await inboxSocketService.emitNewConversation(workspace, conversation, contact, message);
          }
          
          // Also emit legacy event for backward compatibility
          getIO()?.to(`workspace:${workspace}`).emit('message.received', {
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

// ✅ Process status updates + update campaign stats (Stage 3 Enhanced)
async function processStatusUpdates(statuses, workspace) {
  const CampaignMessage = require('../models/CampaignMessage');
  const Campaign = require('../models/Campaign');
  const { processCampaignStatusUpdate } = require('../services/campaignWebhookService');
  
  for (const status of statuses) {
    try {
      const messageId = status.id;
      const newStatus = status.status; // 'sent', 'delivered', 'read', 'failed'
      const statusTimestamp = status.timestamp ? new Date(status.timestamp * 1000) : new Date();
      
      // ═══════════════════════════════════════════════════════════════════
      // STAGE 3: Campaign Status Rollup via dedicated service
      // ═══════════════════════════════════════════════════════════════════
      try {
        const campaignResult = await processCampaignStatusUpdate(
          messageId,
          newStatus,
          statusTimestamp,
          status
        );
        
        if (campaignResult.processed) {
          console.log(`[Webhook] Campaign status rolled up: ${campaignResult.campaignId} - ${newStatus}`);
        }
      } catch (campaignErr) {
        console.error('[Webhook] Campaign status rollup error:', campaignErr.message);
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // Standard message status update (also handles non-campaign messages)
      // ═══════════════════════════════════════════════════════════════════
      
      const query = { 
        $or: [
          { 'meta.whatsappId': messageId },
          { whatsappMessageId: messageId }
        ]
      };
      if (workspace) query.workspace = workspace;
      
      const message = await Message.findOne(query);
      
      if (message) {
        message.status = newStatus;
        if (!message.meta) message.meta = {};
        if (!message.meta.statusUpdates) message.meta.statusUpdates = [];
        message.meta.statusUpdates.push({
          status: newStatus,
          timestamp: status.timestamp,
          ...status
        });
        
        // ✅ Update timestamp fields
        if (newStatus === 'sent' && !message.sentAt) {
          message.sentAt = statusTimestamp;
        }
        if (newStatus === 'delivered' && !message.deliveredAt) {
          message.deliveredAt = statusTimestamp;
        }
        if (newStatus === 'read' && !message.readAt) {
          message.readAt = statusTimestamp;
        }
        if (newStatus === 'failed' && !message.failedAt) {
          message.failedAt = statusTimestamp;
          message.failureReason = status.errors?.[0]?.message || 'Unknown error';
        }
        
        await message.save();
        
        // ✅ Legacy CampaignMessage update (for backwards compatibility)
        if (message.meta?.campaignMessageId) {
          const campaignMessage = await CampaignMessage.findByIdAndUpdate(
            message.meta.campaignMessageId,
            {
              status: newStatus,
              sentAt: newStatus === 'sent' ? statusTimestamp : undefined,
              deliveredAt: newStatus === 'delivered' ? statusTimestamp : undefined,
              readAt: newStatus === 'read' ? statusTimestamp : undefined,
              failedAt: newStatus === 'failed' ? statusTimestamp : undefined,
              failureReason: newStatus === 'failed' ? (status.errors?.[0]?.message || 'Unknown') : undefined,
              updatedAt: new Date()
            },
            { new: true }
          ).populate('campaign');
          
          // ✅ Update Campaign stats atomically (legacy path)
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
        
        // Stage 4: Emit inbox message status event
        try {
          if (workspace && message.conversation) {
            await inboxSocketService.emitMessageStatus(
              workspace, 
              message.conversation, 
              message._id, 
              newStatus, 
              statusTimestamp
            );
          }
          
          // Also emit legacy event for backward compatibility
          if (workspace) {
            getIO()?.to(`workspace:${workspace}`).emit('message.status', {
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
    if (Array.isArray(templateUpdate)) {
      const results = [];
      for (const update of templateUpdate) {
        results.push(await processTemplateStatusUpdate(update, workspace, workspaceDoc));
      }
      return { success: true, results };
    }

    const { 
      event, 
      message_template_id,
      message_template_name, 
      message_template_language, 
      reason 
    } = templateUpdate;

    const rawEvent = (event || templateUpdate.status || templateUpdate.message_template_status || '').toString().toUpperCase();
    if (!rawEvent) {
      console.warn('[BSP Webhook] Template update missing event/status');
      return { success: false, reason: 'missing_event' };
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // BSP TEMPLATE ROUTING
    // Templates are namespaced: {workspaceIdSuffix}_{templateName}
    // We need to route to the correct workspace
    // ═══════════════════════════════════════════════════════════════════
    
    let targetWorkspace = workspace;

    // If we can resolve by template ID/name, prefer authoritative mapping
    if (!targetWorkspace && (message_template_id || message_template_name)) {
      const existingTemplate = await Template.findOne({
        $or: [
          { metaTemplateId: message_template_id },
          { metaTemplateName: message_template_name }
        ]
      }).select('workspace');
      if (existingTemplate?.workspace) {
        targetWorkspace = existingTemplate.workspace;
      }
    }
    
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
      const prefix = parts[0];
      if (prefix.length === 8) {
        originalTemplateName = parts.slice(1).join('_'); // Remove the workspace prefix
      }
    }

    const nameCandidates = [
      originalTemplateName,
      originalTemplateName?.toLowerCase(),
      message_template_name,
      message_template_name?.toLowerCase()
    ].filter(Boolean);
    
    // Build query to find the template
    const query = {
      language: message_template_language
    };
    
    // Search by Meta ID, namespaced name, or original name
    if (targetWorkspace) {
      query.workspace = targetWorkspace;
      query.$or = [
        { metaTemplateId: message_template_id },
        { metaTemplateName: { $in: nameCandidates } },
        { name: { $in: nameCandidates } }
      ];
    } else {
      query.$or = [
        { metaTemplateId: message_template_id },
        { metaTemplateName: { $in: nameCandidates } },
        { name: { $in: nameCandidates } }
      ];
    }
    
    const template = await Template.findOne(query);
    
    if (template) {
      // ─────────────────────────────────────────────────────────────────────────────
      // STAGE 2 HARDENING - TASK D: WEBHOOK STATE AUTHORITY
      // Webhook updates are authoritative - always overwrite local status
      // Implement idempotency to prevent duplicate processing
      // ─────────────────────────────────────────────────────────────────────────────
      
      // Generate unique event ID for idempotency
      const webhookEventId = `${message_template_id}_${rawEvent}_${Date.now()}`;
      
      // Check for duplicate webhook (same event within 5 seconds)
      if (template.lastWebhookEventId && template.lastWebhookUpdate) {
        const lastEventParts = template.lastWebhookEventId.split('_');
        const lastEventType = lastEventParts[1];
        const timeSinceLastUpdate = Date.now() - new Date(template.lastWebhookUpdate).getTime();
        
        // Skip if same event type received within 5 seconds (duplicate)
        if (lastEventType === rawEvent && timeSinceLastUpdate < 5000) {
          console.log(`[BSP Webhook] ⏭️ Skipping duplicate template event: ${rawEvent} for ${message_template_name}`);
          return { success: true, skipped: true, reason: 'duplicate_event' };
        }
      }
      
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
        'FLAGGED_FOR_REVIEW': 'DISABLED',
        'IN_APPEAL': 'PENDING',
        'QUALITY_PENDING': 'PENDING',
        'PAUSED': 'PAUSED',
        'AUTO_DISABLED': 'DISABLED',
        'BLOCKED': 'DISABLED'
      };
      
      const newStatus = statusMap[rawEvent] || rawEvent;
      
      // ─────────────────────────────────────────────────────────────────────────────
      // AUTHORITATIVE UPDATE: Webhook status always wins
      // This prevents race conditions between local submission and webhook
      // ─────────────────────────────────────────────────────────────────────────────
      template.status = newStatus;
      template.metaTemplateId = message_template_id || template.metaTemplateId;
      template.metaTemplateName = message_template_name;
      template.lastWebhookUpdate = new Date();
      template.lastWebhookEventId = webhookEventId; // Store for idempotency
      
      // Stage 2 Enhancement: Parse and store detailed rejection info
      if (reason) {
        template.rejectionReason = reason;
        template.rejectionDetails = parseRejectionReason(reason);
      }
      
      // Stage 2 Enhancement: Clear rejection on approval
      if (newStatus === 'APPROVED') {
        template.rejectionReason = null;
        template.rejectionDetails = null;
        
        // If this is a forked version that got approved, mark it as active
        // and deactivate the original
        if (template.originalTemplateId) {
          template.isActiveVersion = true;
          await Template.findByIdAndUpdate(template.originalTemplateId, {
            isActiveVersion: false
          });
          console.log(`[BSP Webhook] Forked template approved - activated new version, deactivated original`);
        }
      }
      
      // Add to approval history if status changed
      if (previousStatus !== newStatus) {
        template.approvalHistory = template.approvalHistory || [];
        template.approvalHistory.push({
          status: newStatus,
          timestamp: new Date(),
          reason: reason,
          source: 'WEBHOOK',
          metaEventId: message_template_id,
          authoritative: true // Mark as authoritative webhook update
        });
      }
      
      // Set approved/rejected timestamps
      if (newStatus === 'APPROVED' && !template.approvedAt) {
        template.approvedAt = new Date();
      }
      if (newStatus === 'REJECTED') {
        template.rejectedAt = new Date();
      }
      
      await template.save();
      
      console.log(`[BSP Webhook] Template ${message_template_name} status: ${previousStatus} → ${newStatus} (authoritative)`);
      
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
            rejectionDetails: template.rejectionDetails,
            timestamp: new Date(),
            authoritative: true // Inform client this is authoritative
          });
        } catch (socketErr) {
          console.error('Socket emit error:', socketErr.message);
        }
      }
      
      return { success: true, templateId: template._id, newStatus, authoritative: true };
    } else {
      console.warn(`[BSP Webhook] Template not found: ${message_template_name} (ID: ${message_template_id})`);
      return { success: false, reason: 'Template not found' };
    }
  } catch (templateErr) {
    console.error('[BSP Webhook] Error processing template update:', templateErr);
    return { success: false, error: templateErr.message };
  }
}

/**
 * Stage 2: Parse Meta rejection reason into structured format
 */
function parseRejectionReason(reason) {
  if (!reason) return null;
  
  const rejectionPatterns = {
    SCAM: /scam|fraud|phishing/i,
    PROMOTIONAL_CONTENT: /promotional|marketing.*utility|wrong.*category/i,
    ABUSIVE_CONTENT: /abusive|offensive|violent|hate/i,
    INVALID_FORMAT: /format|variable|parameter|syntax/i,
    MISSING_EXAMPLE: /example|sample/i,
    INVALID_URL: /url|link/i,
    INVALID_MEDIA: /media|image|video|document/i,
    DUPLICATE: /duplicate|already.*exist/i,
    TRADEMARK: /trademark|copyright|brand/i,
    POLICY_VIOLATION: /policy|violat|terms/i
  };
  
  let category = 'OTHER';
  for (const [cat, pattern] of Object.entries(rejectionPatterns)) {
    if (pattern.test(reason)) {
      category = cat;
      break;
    }
  }
  
  return {
    reason,
    category,
    timestamp: new Date(),
    helpText: getRejectionHelpText(category)
  };
}

/**
 * Get help text for rejection categories
 */
function getRejectionHelpText(category) {
  const helpTexts = {
    SCAM: 'Remove any content that could be perceived as fraudulent or misleading.',
    PROMOTIONAL_CONTENT: 'Change category to MARKETING or remove promotional language for UTILITY templates.',
    ABUSIVE_CONTENT: 'Remove offensive, violent, or hateful content.',
    INVALID_FORMAT: 'Check variable format - must be {{1}}, {{2}}, etc. in sequence.',
    MISSING_EXAMPLE: 'Add example values for all variables.',
    INVALID_URL: 'Ensure URL is valid, uses HTTPS, and doesn\'t use URL shorteners.',
    INVALID_MEDIA: 'Check media URL/handle is valid and accessible.',
    DUPLICATE: 'A template with this name already exists. Use a different name.',
    TRADEMARK: 'Remove trademarked terms or get proper authorization.',
    POLICY_VIOLATION: 'Review WhatsApp Business Policy and remove violating content.',
    OTHER: 'Review the rejection reason and update content accordingly.'
  };
  
  return helpTexts[category] || helpTexts.OTHER;
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

    // ─────────────────────────────────────────────────────────────────────────
    // PHONE STATUS MONITORING (Interakt-grade safety)
    // Meta may emit phone status changes via account_update.
    // We persist last known status and alert owner if DISABLED/SUSPENDED.
    // ─────────────────────────────────────────────────────────────────────────
    const rawPhoneStatus = accountUpdate.phone_status || accountUpdate.phone_number_status || accountUpdate.status;
    if (rawPhoneStatus) {
      const normalizedStatus = rawPhoneStatus.toString().toUpperCase();
      const previousStatus = wsDoc.bspPhoneStatus || null;

      if (normalizedStatus !== previousStatus) {
        if (!wsDoc.bspAudit) wsDoc.bspAudit = {};
        wsDoc.bspPhoneStatus = normalizedStatus;
        wsDoc.bspAudit.lastStatusCheck = new Date();

        // Alert on DISABLED/SUSPENDED (Meta enforcement states)
        const ALERT_STATUSES = ['DISABLED', 'SUSPENDED', 'BANNED'];
        const shouldAlert = ALERT_STATUSES.includes(normalizedStatus);

        if (shouldAlert) {
          if (!wsDoc.bspAudit.warnings) wsDoc.bspAudit.warnings = [];
          wsDoc.bspAudit.warnings.push({
            type: 'PHONE_STATUS',
            message: `Phone status changed to ${normalizedStatus}`
          });
        }

        await wsDoc.save();

        // Sync ChildBusiness lifecycle state
        await updateChildBusinessByPhoneNumberId(
          wsDoc.bspPhoneNumberId || wsDoc.phoneNumberId || wsDoc.whatsappPhoneNumberId,
          { phoneStatusRaw: normalizedStatus }
        ).catch(() => null);

        // Create audit log for internal visibility (acts as owner alert)
        try {
          const owner = await User.findOne({ workspace: wsDoc._id, role: 'owner' }).select('_id email');
          const action = shouldAlert ? 'waba.disabled' : 'settings.updated';
          await AuditLog.create({
            workspace: wsDoc._id,
            user: owner?._id || null,
            action,
            resource: {
              type: 'whatsapp_phone',
              name: wsDoc.bspDisplayPhoneNumber || wsDoc.whatsappPhoneNumber || null
            },
            details: {
              from: previousStatus,
              to: normalizedStatus,
              phoneNumberId: wsDoc.bspPhoneNumberId || wsDoc.phoneNumberId || null,
              ownerEmail: owner?.email || null
            }
          });
        } catch (logErr) {
          console.error('[Webhook] Failed to write phone status audit log:', logErr.message);
        }

        if (shouldAlert) {
          console.warn(`[Webhook] ⚠️ Phone status is ${normalizedStatus} for workspace ${workspace}`);
        }
      }
    }
    
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
      const VALID_ACCOUNT_STATUSES = ['ACTIVE', 'DISABLED', 'PENDING_REVIEW', 'SUSPENDED'];
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
      if (account_status === 'DISABLED' || account_status === 'PENDING_REVIEW' || account_status === 'SUSPENDED') {
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

    // Quality score monitoring hook (if provided by Meta)
    const qualityRating = accountUpdate.quality_rating || accountUpdate.quality_score || accountUpdate.quality_rating_status;
    if (qualityRating) {
      const normalizedQuality = qualityRating.toString().toUpperCase();
      wsDoc.bspQualityRating = normalizedQuality;
      wsDoc.bspAudit = wsDoc.bspAudit || {};
      wsDoc.bspAudit.lastQualityUpdate = new Date();
      await wsDoc.save();

      await updateChildBusinessByPhoneNumberId(
        wsDoc.bspPhoneNumberId || wsDoc.phoneNumberId || wsDoc.whatsappPhoneNumberId,
        { qualityRating: normalizedQuality }
      ).catch(() => null);
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

/**
 * Redact PII from webhook payload before persistence
 * WHY: Meta compliance and data minimization
 */
function redactWebhookPayload(payload) {
  try {
    const cloned = JSON.parse(JSON.stringify(payload));

    if (!cloned?.entry) return cloned;

    for (const entry of cloned.entry) {
      for (const change of entry.changes || []) {
        const value = change.value || {};

        // Redact contacts
        if (Array.isArray(value.contacts)) {
          value.contacts = value.contacts.map(c => ({
            ...c,
            wa_id: c.wa_id ? maskPhone(c.wa_id) : c.wa_id,
            profile: c.profile ? { name: '[REDACTED]' } : c.profile
          }));
        }

        // Redact message bodies and phone numbers
        if (Array.isArray(value.messages)) {
          value.messages = value.messages.map(m => ({
            ...m,
            from: m.from ? maskPhone(m.from) : m.from,
            text: m.text ? { body: '[REDACTED]' } : m.text,
            button: m.button ? { text: '[REDACTED]' } : m.button,
            interactive: m.interactive ? { ...m.interactive, body: '[REDACTED]' } : m.interactive
          }));
        }

        // Redact status recipient ids
        if (Array.isArray(value.statuses)) {
          value.statuses = value.statuses.map(s => ({
            ...s,
            recipient_id: s.recipient_id ? maskPhone(s.recipient_id) : s.recipient_id
          }));
        }

        change.value = value;
      }
    }

    return cloned;
  } catch (err) {
    console.error('[Webhook] Redaction failed:', err.message);
    return { error: 'redaction_failed' };
  }
}

function maskPhone(value) {
  const digits = (value || '').toString();
  if (digits.length <= 4) return '****';
  return `****${digits.slice(-4)}`;
}

module.exports = { verify, handler };
