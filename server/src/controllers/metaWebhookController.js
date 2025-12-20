const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Workspace = require('../models/Workspace');
const WebhookLog = require('../models/WebhookLog');
const Template = require('../models/Template');
const { getIO } = require('../utils/socket');
const metaService = require('../services/metaService');

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
        await WebhookLog.create({
          payload: body,
          verified: false,
          signatureHeader,
          error: 'Signature verification failed'
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
      
      await WebhookLog.create({
        workspace,
        payload: body,
        verified: true,
        signatureHeader,
        eventType,
        processed: false
      });
      
      // Process messages
      if (value.messages) {
        await processInboundMessages(value.messages, workspace, value.contacts);
      }
      
      // Process status updates
      if (value.statuses) {
        await processStatusUpdates(value.statuses, workspace);
      }
      
      // Process template status updates
      if (value.message_template_status_update) {
        await processTemplateStatusUpdate(value.message_template_status_update, workspace);
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

// Process status updates
async function processStatusUpdates(statuses, workspace) {
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
        await message.save();
        
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

module.exports = { verify, handler };
