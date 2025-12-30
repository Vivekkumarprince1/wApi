const AutoReply = require('../models/AutoReply');
const AutoReplyLog = require('../models/AutoReplyLog');
const Message = require('../models/Message');
const Template = require('../models/Template');
const Contact = require('../models/Contact');
const Workspace = require('../models/Workspace');
const metaService = require('./metaService');

/**
 * Check if auto-reply should be sent for inbound message
 * Returns { shouldSend: boolean, autoReplyId?: string, reason?: string }
 */
async function checkAutoReply(messageBody, contact, workspace) {
  // Get all enabled auto-replies for workspace
  const autoReplies = await AutoReply.find({
    workspace,
    enabled: true
  }).populate('template');

  for (const autoReply of autoReplies) {
    // Check keyword match
    const matches = matchKeywords(messageBody, autoReply.keywords, autoReply.matchMode);
    
    if (!matches) continue;

    // Check 24-hour window
    const lastReplyLog = await AutoReplyLog.findOne({
      autoReply: autoReply._id,
      contact: contact._id
    }).sort({ sentAt: -1 });

    if (lastReplyLog) {
      const hoursSinceLastReply = (Date.now() - lastReplyLog.sentAt) / (1000 * 60 * 60);
      if (hoursSinceLastReply < 24) {
        console.log(`[AutoReply] 24h window not expired for ${contact.phone} (${hoursSinceLastReply.toFixed(1)}h ago)`);
        continue; // Try next auto-reply
      }
    }

    // Check template is still approved
    if (autoReply.template.status !== 'APPROVED') {
      console.warn(`[AutoReply] Template ${autoReply.template.name} is no longer approved`);
      continue; // Try next auto-reply
    }

    // ✅ All checks passed - send this auto-reply
    return {
      shouldSend: true,
      autoReplyId: autoReply._id,
      autoReplyData: autoReply
    };
  }

  // No matching auto-reply
  return {
    shouldSend: false,
    reason: 'No matching keyword or 24h window constraint'
  };
}

/**
 * Match keywords in message body based on match mode
 */
function matchKeywords(messageBody, keywords, matchMode = 'contains') {
  const lowerBody = (messageBody || '').toLowerCase();
  
  return keywords.some(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    
    switch (matchMode) {
      case 'exact':
        return lowerBody === lowerKeyword;
      case 'starts_with':
        return lowerBody.startsWith(lowerKeyword);
      case 'contains':
      default:
        return lowerBody.includes(lowerKeyword);
    }
  });
}

/**
 * Send auto-reply to contact
 * Returns { success: boolean, messageId?: string, error?: string }
 */
async function sendAutoReply(autoReply, contact, workspace, triggeringMessage) {
  try {
    // Get workspace for credentials
    const workspaceDoc = await Workspace.findById(workspace);
    if (!workspaceDoc) {
      throw new Error('Workspace not found');
    }

    const accessToken = workspaceDoc.whatsappAccessToken;
    const phoneNumberId = workspaceDoc.whatsappPhoneNumberId;
    
    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp credentials not configured');
    }

    // Get template with full details
    const template = await Template.findById(autoReply.template);
    if (!template) {
      throw new Error('Template not found');
    }

    // Check template is still approved
    if (template.status !== 'APPROVED') {
      throw new Error('Template is not approved');
    }

    // Build components for Meta API
    const components = buildTemplateComponents(template);

    // Create message record BEFORE sending
    const message = await Message.create({
      workspace,
      contact: contact._id,
      direction: 'outbound',
      type: 'template',
      body: `[Auto-reply] ${template.name}`,
      status: 'sending',
      meta: {
        templateId: template._id,
        templateName: template.name,
        autoReplyId: autoReply._id,
        triggeredByMessage: triggeringMessage._id,
        isAutoReply: true
      }
    });

    // Send via Meta Cloud API
    const result = await metaService.sendTemplateMessage(
      accessToken,
      phoneNumberId,
      contact.phone,
      template.name,
      'en', // Default language
      components
    );

    // Update message with sent status
    message.status = 'sent';
    message.sentAt = new Date();
    message.meta.whatsappId = result.messageId;
    await message.save();

    // Log the auto-reply for 24-hour window tracking
    await AutoReplyLog.create({
      workspace,
      autoReply: autoReply._id,
      contact: contact._id,
      messageId: triggeringMessage._id,
      sentAt: new Date()
    });

    // Update auto-reply statistics
    await AutoReply.updateOne(
      { _id: autoReply._id },
      {
        totalRepliesSent: (autoReply.totalRepliesSent || 0) + 1,
        lastSentAt: new Date()
      }
    );

    // Increment workspace usage
    workspaceDoc.usage.messages = (workspaceDoc.usage.messages || 0) + 1;
    workspaceDoc.usage.messagesDaily = (workspaceDoc.usage.messagesDaily || 0) + 1;
    workspaceDoc.usage.messagesThisMonth = (workspaceDoc.usage.messagesThisMonth || 0) + 1;
    await workspaceDoc.save();

    console.log(`[AutoReply] ✅ Sent to ${contact.phone} (${template.name})`);

    return {
      success: true,
      messageId: message._id,
      whatsappId: result.messageId
    };
  } catch (err) {
    console.error(`[AutoReply] ❌ Error sending auto-reply:`, err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Build template components for Meta API
 * (same as workflowExecutionService)
 */
function buildTemplateComponents(template) {
  const components = [];

  // Find HEADER component
  const headerComponent = template.components?.find(c => c.type === 'HEADER');
  if (headerComponent) {
    // For auto-replies, no variable substitution - just send as-is
    if (headerComponent.format === 'TEXT') {
      components.push({
        type: 'header',
        parameters: [{ type: 'text', text: headerComponent.text }]
      });
    }
  }

  // Find BODY component
  const bodyComponent = template.components?.find(c => c.type === 'BODY');
  if (bodyComponent) {
    // Extract variables from body text
    const variableMatches = (bodyComponent.text || '').match(/\{\{(\d+)\}\}/g) || [];
    const parameterCount = variableMatches.length;

    if (parameterCount > 0) {
      // For auto-replies with variables, use placeholder values
      const parameters = Array.from({ length: parameterCount }, (_, i) => ({
        type: 'text',
        text: `Value${i + 1}` // Placeholder
      }));
      components.push({
        type: 'body',
        parameters
      });
    } else {
      // No variables - send as-is
      components.push({
        type: 'body',
        parameters: [{ type: 'text', text: bodyComponent.text }]
      });
    }
  }

  return components;
}

/**
 * Get auto-reply plan limits for workspace plan
 */
function getPlanLimits(plan = 'free') {
  const limits = {
    free: {
      autoReplies: 3,
      dailyAutoRepliesToSend: 100
    },
    basic: {
      autoReplies: 10,
      dailyAutoRepliesToSend: 1000
    },
    premium: {
      autoReplies: 20,
      dailyAutoRepliesToSend: 10000
    }
  };

  return limits[plan] || limits.free;
}

/**
 * Check if workspace can create more auto-replies
 */
async function checkAutoReplyLimits(workspace) {
  const workspaceDoc = await Workspace.findById(workspace);
  if (!workspaceDoc) throw new Error('Workspace not found');

  const plan = workspaceDoc.plan || 'free';
  const limits = getPlanLimits(plan);

  const count = await AutoReply.countDocuments({ workspace });
  
  if (count >= limits.autoReplies) {
    return {
      allowed: false,
      reason: `Plan limit reached (${count}/${limits.autoReplies}). Upgrade to ${plan === 'free' ? 'basic' : 'premium'} to create more auto-replies.`
    };
  }

  return {
    allowed: true,
    current: count,
    limit: limits.autoReplies
  };
}

module.exports = {
  checkAutoReply,
  sendAutoReply,
  matchKeywords,
  buildTemplateComponents,
  getPlanLimits,
  checkAutoReplyLimits
};
