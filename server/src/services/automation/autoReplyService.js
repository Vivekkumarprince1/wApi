const { AutoReply, AutoReplyLog, Template, Contact, Workspace } = require('../../models');
const templateSendingService = require('../template/templateSendingService');
const bspMessagingService = require('../bsp/bspMessagingService');
const { isWithinBusinessHours } = require('./automationSafetyGuards');

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

  // Sort: keyword matches first, then outside_business_hours, then always
  const sortedReplies = autoReplies.sort((a, b) => {
    const priority = { 'keyword': 1, 'outside_business_hours': 2, 'always': 3 };
    return priority[a.triggerType] - priority[b.triggerType];
  });

  const workspaceDoc = await Workspace.findById(workspace).select('settings').lean();

  for (const autoReply of sortedReplies) {
    let matches = false;

    if (autoReply.triggerType === 'keyword') {
      matches = matchKeywords(messageBody, autoReply.keywords, autoReply.matchMode);
    } else if (autoReply.triggerType === 'outside_business_hours') {
      matches = !isWithinBusinessHours(workspaceDoc?.settings);
    } else if (autoReply.triggerType === 'always') {
      matches = true;
    }
    
    if (!matches) continue;

    // ✅ Requirement 3: Rule-Level Throttling (Interakt-style)
    const lastReplyLog = await AutoReplyLog.findOne({
      autoReply: autoReply._id,
      contact: contact._id
    }).sort({ sentAt: -1 });

    if (lastReplyLog) {
      const hoursSinceLastReply = (Date.now() - lastReplyLog.sentAt) / (1000 * 60 * 60);
      if (hoursSinceLastReply < 24) {
        console.log(`[AutoReply] Rule ${autoReply._id} recently sent to ${contact.phone} (${hoursSinceLastReply.toFixed(1)}h ago)`);
        continue;
      }
    }

    // Ensure template is populated and approved if using template mode
    if (autoReply.replyType === 'template') {
      if (!autoReply.template || typeof autoReply.template === 'string' || !autoReply.template.status) {
         console.warn(`[AutoReply] Template for rule ${autoReply._id} not populated or missing`);
         continue;
      }

      if (autoReply.template.status !== 'APPROVED') {
        console.warn(`[AutoReply] Template ${autoReply.template.name} is no longer approved`);
        continue; // Try next auto-reply
      }
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
    const workspaceId = workspace._id || workspace;
    const workspaceDoc = await Workspace.findById(workspaceId);
    if (!workspaceDoc) throw new Error('Workspace not found');

    // ─────────────────────────────────────────────────────────────────────────────
    // ✅ PHASE 3: SESSION OPTIMIZATION (Meta Cost Saving)
    // ─────────────────────────────────────────────────────────────────────────────
    const isSessionActive = await bspMessagingService.canSendSessionMessage(workspaceId, contact.phone);

    if (autoReply.replyType === 'text' && isSessionActive) {
      console.log(`[AutoReply] Utilizing Free Session Window for ${contact.phone}`);
      
      const sessionText = resolveContactVariables(autoReply.textMessage, contact);
      
      const result = await bspMessagingService.sendTextMessage(
        workspaceId,
        contact.phone,
        sessionText,
        { contactId: contact._id, conversationId: triggeringMessage.conversation }
      );

      await logAndStats(autoReply, contact, workspaceId, triggeringMessage);
      
      return { success: true, messageId: result.messageId };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ✅ PHASE 3: DYNAMIC VARIABLE RESOLVING (Fixes "Value1" Bug)
    // ─────────────────────────────────────────────────────────────────────────────
    const template = await Template.findById(autoReply.template);
    if (!template) throw new Error('Template not found');

    // Resolve mapped variables from contact fields
    const resolvedBodyVars = [];
    if (autoReply.variableMapping && autoReply.variableMapping.length > 0) {
      // Sort by variable index to ensure {{1}}, {{2}} order
      const mappings = [...autoReply.variableMapping].sort((a, b) => parseInt(a.variable) - parseInt(b.variable));
      
      for (const mapping of mappings) {
        const val = getContactField(contact, mapping.contactField) || mapping.fallbackValue || 'there';
        resolvedBodyVars.push(String(val));
      }
    }

    // Send via template service with resolved variables
    const result = await templateSendingService.sendTemplate({
      workspaceId,
      templateId: template._id,
      to: contact.phone,
      variables: { body: resolvedBodyVars },
      contactId: contact._id,
      meta: {
        autoReplyId: autoReply._id,
        triggeredByMessage: triggeringMessage._id,
        isAutoReply: true
      }
    });

    await logAndStats(autoReply, contact, workspaceId, triggeringMessage);

    return { success: true, messageId: result.messageId };
  } catch (err) {
    console.error(`[AutoReply] ❌ Error sending auto-reply:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Helper to get nested contact field values
 */
function getContactField(contact, path) {
  if (!path) return null;
  const parts = path.split('.');
  let current = contact;
  
  // Convert document to plain object for easier traversal if it's a Mongoose doc
  if (current && typeof current.toObject === 'function') {
    current = current.toObject();
  }

  for (const part of parts) {
    if (current == null) return null;
    
    // Support for Map objects (including Mongoose Maps converted to objects)
    if (current[part] !== undefined) {
      current = current[part];
    } else if (current.get && typeof current.get === 'function' && current.get(part)) {
      current = current.get(part);
    } else {
      return null;
    }
  }
  return current;
}

/**
 * Resolve variables in a plain text string
 */
function resolveContactVariables(text, contact) {
  if (!text) return '';
  return text.replace(/\{\{([^{}]+)\}\}/g, (match, field) => {
    return getContactField(contact, field.trim()) || match;
  });
}

/**
 * Internal helper for log and stats
 */
async function logAndStats(autoReply, contact, workspaceId, triggeringMessage) {
  await AutoReplyLog.create({
    workspace: workspaceId,
    autoReply: autoReply._id,
    contact: contact._id,
    messageId: triggeringMessage._id,
    sentAt: new Date()
  });

  await AutoReply.updateOne(
    { _id: autoReply._id },
    {
      $inc: { totalRepliesSent: 1 },
      $set: { lastSentAt: new Date() }
    }
  );
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
