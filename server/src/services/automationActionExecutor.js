/**
 * Automation Action Executor - Stage 6 Automation Engine
 * 
 * Executes automation actions with proper error handling,
 * WhatsApp rule compliance, and permission validation.
 */

const mongoose = require('mongoose');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Template = require('../models/Template');
const Deal = require('../models/Deal');
const Pipeline = require('../models/Pipeline');
const User = require('../models/User');
const { logger } = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if conversation is within 24h window (for session messages)
 */
async function isWithin24hWindow(conversationId) {
  if (!conversationId) return false;
  
  const conversation = await Conversation.findById(conversationId)
    .select('lastCustomerMessageAt')
    .lean();
  
  if (!conversation?.lastCustomerMessageAt) return false;
  
  const hoursSince = (Date.now() - new Date(conversation.lastCustomerMessageAt).getTime()) / (1000 * 60 * 60);
  return hoursSince < 24;
}

/**
 * Get WhatsApp sending service
 */
function getWhatsAppService() {
  try {
    return require('./whatsappService');
  } catch {
    return require('./whatsappCloudService');
  }
}

/**
 * Resolve template variables from context
 */
function resolveTemplateVariables(variables, context) {
  if (!variables) return {};
  
  const resolved = {};
  
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      // Extract field path from {{field.path}}
      const fieldPath = value.slice(2, -2).trim();
      const parts = fieldPath.split('.');
      let resolvedValue = context;
      
      for (const part of parts) {
        if (resolvedValue === null || resolvedValue === undefined) break;
        resolvedValue = resolvedValue[part];
      }
      
      resolved[key] = resolvedValue || value;
    } else {
      resolved[key] = value;
    }
  }
  
  return resolved;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

const actionHandlers = {
  
  /**
   * Send a template message (can be sent anytime)
   */
  async send_template_message(config, context) {
    const { templateId, templateName, templateLanguage, templateVariables } = config;
    const { workspaceId, contactId, contact } = context;
    
    // Get template
    let template;
    if (templateId) {
      template = await Template.findOne({ _id: templateId, workspace: workspaceId });
    } else if (templateName) {
      template = await Template.findOne({ 
        workspace: workspaceId, 
        name: templateName,
        status: 'APPROVED'
      });
    }
    
    if (!template) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }
    
    if (template.status !== 'APPROVED') {
      throw new Error('TEMPLATE_NOT_APPROVED');
    }
    
    // Get phone number
    const phone = contact?.phone || (await Contact.findById(contactId))?.phone;
    if (!phone) {
      throw new Error('INVALID_PHONE');
    }
    
    // Resolve variables
    const resolvedVariables = resolveTemplateVariables(templateVariables || config.params, context);
    
    // Send via WhatsApp service
    const whatsappService = getWhatsAppService();
    const result = await whatsappService.sendTemplateMessage(workspaceId, {
      to: phone,
      templateName: template.name,
      templateLanguage: templateLanguage || template.language || 'en',
      components: resolvedVariables
    });
    
    return { 
      success: true, 
      messageId: result?.messageId,
      template: template.name 
    };
  },
  
  /**
   * Send a template (legacy alias)
   */
  async send_template(config, context) {
    return actionHandlers.send_template_message(config, context);
  },
  
  /**
   * Send a text message (24h window only)
   */
  async send_text_message(config, context) {
    const { messageContent } = config;
    const { workspaceId, conversationId, contactId, contact } = context;
    
    // Check 24h window
    if (!await isWithin24hWindow(conversationId)) {
      throw new Error('NO_24H_WINDOW');
    }
    
    // Get phone number
    const phone = contact?.phone || (await Contact.findById(contactId))?.phone;
    if (!phone) {
      throw new Error('INVALID_PHONE');
    }
    
    // Send via WhatsApp service
    const whatsappService = getWhatsAppService();
    const result = await whatsappService.sendMessage(workspaceId, {
      to: phone,
      type: 'text',
      text: { body: messageContent }
    });
    
    return { 
      success: true, 
      messageId: result?.messageId 
    };
  },
  
  /**
   * Send a media message (24h window only)
   */
  async send_media_message(config, context) {
    const { mediaUrl, mediaType, messageContent } = config;
    const { workspaceId, conversationId, contactId, contact } = context;
    
    // Check 24h window
    if (!await isWithin24hWindow(conversationId)) {
      throw new Error('NO_24H_WINDOW');
    }
    
    // Get phone number
    const phone = contact?.phone || (await Contact.findById(contactId))?.phone;
    if (!phone) {
      throw new Error('INVALID_PHONE');
    }
    
    // Send via WhatsApp service
    const whatsappService = getWhatsAppService();
    const result = await whatsappService.sendMessage(workspaceId, {
      to: phone,
      type: mediaType || 'image',
      [mediaType || 'image']: {
        link: mediaUrl,
        caption: messageContent
      }
    });
    
    return { 
      success: true, 
      messageId: result?.messageId 
    };
  },
  
  /**
   * Assign conversation to agent/team
   */
  async assign_conversation(config, context) {
    const { assignTo, agentId } = config;
    const { workspaceId, conversationId } = context;
    
    if (!conversationId) {
      throw new Error('NO_CONVERSATION');
    }
    
    let targetAgentId = assignTo?.agentId || agentId;
    
    // Handle assignment type
    if (assignTo?.type === 'round_robin' || assignTo?.type === 'least_busy') {
      // Get available agents
      const agents = await User.find({ 
        workspace: workspaceId, 
        role: { $in: ['agent', 'admin'] },
        isActive: true 
      }).select('_id').lean();
      
      if (agents.length === 0) {
        throw new Error('NO_AVAILABLE_AGENTS');
      }
      
      if (assignTo.type === 'round_robin') {
        // Simple round-robin: pick random agent
        targetAgentId = agents[Math.floor(Math.random() * agents.length)]._id;
      } else {
        // Least busy: agent with fewest open conversations
        const agentLoads = await Conversation.aggregate([
          {
            $match: {
              workspace: new mongoose.Types.ObjectId(workspaceId),
              assignedTo: { $in: agents.map(a => a._id) },
              status: 'open'
            }
          },
          {
            $group: {
              _id: '$assignedTo',
              count: { $sum: 1 }
            }
          }
        ]);
        
        const loadMap = new Map(agentLoads.map(l => [l._id.toString(), l.count]));
        let minLoad = Infinity;
        let leastBusyAgent = agents[0]._id;
        
        for (const agent of agents) {
          const load = loadMap.get(agent._id.toString()) || 0;
          if (load < minLoad) {
            minLoad = load;
            leastBusyAgent = agent._id;
          }
        }
        
        targetAgentId = leastBusyAgent;
      }
    }
    
    if (!targetAgentId) {
      throw new Error('NO_TARGET_AGENT');
    }
    
    // Update conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      assignedTo: targetAgentId,
      assignedAt: new Date()
    });
    
    return { 
      success: true, 
      assignedTo: targetAgentId 
    };
  },
  
  /**
   * Assign agent (legacy alias)
   */
  async assign_agent(config, context) {
    return actionHandlers.assign_conversation(config, context);
  },
  
  /**
   * Add tag to contact
   */
  async add_tag(config, context) {
    const { tagName, tagId, tag } = config;
    const { contactId } = context;
    
    if (!contactId) {
      throw new Error('NO_CONTACT');
    }
    
    const finalTagName = tagName || tag;
    if (!finalTagName && !tagId) {
      throw new Error('NO_TAG_SPECIFIED');
    }
    
    await Contact.findByIdAndUpdate(contactId, {
      $addToSet: { tags: finalTagName }
    });
    
    return { 
      success: true, 
      tag: finalTagName 
    };
  },
  
  /**
   * Remove tag from contact
   */
  async remove_tag(config, context) {
    const { tagName, tagId, tag } = config;
    const { contactId } = context;
    
    if (!contactId) {
      throw new Error('NO_CONTACT');
    }
    
    const finalTagName = tagName || tag;
    if (!finalTagName && !tagId) {
      throw new Error('NO_TAG_SPECIFIED');
    }
    
    await Contact.findByIdAndUpdate(contactId, {
      $pull: { tags: finalTagName }
    });
    
    return { 
      success: true, 
      tag: finalTagName 
    };
  },
  
  /**
   * Move deal to pipeline stage
   */
  async move_pipeline_stage(config, context) {
    const { pipelineId, stageId } = config;
    const { workspaceId, contactId } = context;
    
    // Find deal for contact
    const deal = await Deal.findOne({
      workspace: workspaceId,
      contact: contactId,
      pipeline: pipelineId
    });
    
    if (!deal) {
      throw new Error('DEAL_NOT_FOUND');
    }
    
    // Validate stage exists
    const pipeline = await Pipeline.findById(pipelineId);
    if (!pipeline) {
      throw new Error('PIPELINE_NOT_FOUND');
    }
    
    const stageExists = pipeline.stages.some(s => s.id === stageId || s._id?.toString() === stageId);
    if (!stageExists) {
      throw new Error('INVALID_STAGE');
    }
    
    // Update deal
    deal.stage = stageId;
    deal.stageHistory.push({
      stage: stageId,
      movedAt: new Date(),
      movedBy: null, // Automation
      reason: 'Automation rule'
    });
    await deal.save();
    
    return { 
      success: true, 
      dealId: deal._id,
      newStage: stageId 
    };
  },
  
  /**
   * Create a new deal
   */
  async create_deal(config, context) {
    const { pipelineId, stageId, dealTitle, dealValue } = config;
    const { workspaceId, contactId, contact } = context;
    
    // Get or create default pipeline
    let pipeline;
    if (pipelineId) {
      pipeline = await Pipeline.findById(pipelineId);
    } else {
      pipeline = await Pipeline.findOne({ workspace: workspaceId, isDefault: true });
    }
    
    if (!pipeline) {
      throw new Error('PIPELINE_NOT_FOUND');
    }
    
    // Determine stage
    const targetStage = stageId || pipeline.stages[0]?.id;
    
    // Check if deal already exists
    const existingDeal = await Deal.findOne({
      workspace: workspaceId,
      contact: contactId,
      pipeline: pipeline._id
    });
    
    if (existingDeal) {
      return { 
        success: true, 
        dealId: existingDeal._id,
        message: 'Deal already exists' 
      };
    }
    
    // Create deal
    const deal = await Deal.create({
      workspace: workspaceId,
      pipeline: pipeline._id,
      contact: contactId,
      title: dealTitle || `Deal - ${contact?.name || contact?.phone || 'Unknown'}`,
      value: dealValue || 0,
      stage: targetStage,
      stageHistory: [{
        stage: targetStage,
        movedAt: new Date(),
        reason: 'Created by automation'
      }]
    });
    
    return { 
      success: true, 
      dealId: deal._id 
    };
  },
  
  /**
   * Send notification to agent
   */
  async notify_agent(config, context) {
    const { notificationTitle, notificationBody, notifyAgentId } = config;
    const { workspaceId, conversationId, contactId } = context;
    
    // Get socket service
    try {
      const { getIO } = require('./socket');
      const io = getIO();
      
      if (notifyAgentId) {
        // Send to specific agent
        io.to(`user:${notifyAgentId}`).emit('automation:notification', {
          title: notificationTitle || 'Automation Alert',
          body: notificationBody,
          conversationId,
          contactId,
          timestamp: new Date()
        });
      } else {
        // Send to workspace
        io.to(`workspace:${workspaceId}`).emit('automation:notification', {
          title: notificationTitle || 'Automation Alert',
          body: notificationBody,
          conversationId,
          contactId,
          timestamp: new Date()
        });
      }
      
      return { success: true, notified: true };
    } catch (error) {
      logger.warn('[ActionExecutor] Socket not available for notification:', error.message);
      return { success: true, notified: false, reason: 'Socket unavailable' };
    }
  },
  
  /**
   * Send webhook notification
   */
  async notify_webhook(config, context) {
    const { webhookUrl, url, webhookHeaders } = config;
    const targetUrl = webhookUrl || url;
    
    if (!targetUrl) {
      throw new Error('NO_WEBHOOK_URL');
    }
    
    const axios = require('axios');
    
    const response = await axios.post(targetUrl, {
      event: 'automation.executed',
      workspaceId: context.workspaceId,
      conversationId: context.conversationId,
      contactId: context.contactId,
      timestamp: new Date(),
      metadata: context.metadata
    }, {
      headers: webhookHeaders || {},
      timeout: 10000
    });
    
    return { 
      success: true, 
      status: response.status 
    };
  },
  
  /**
   * Webhook (legacy alias)
   */
  async webhook(config, context) {
    return actionHandlers.notify_webhook(config, context);
  },
  
  /**
   * Update contact fields
   */
  async update_contact(config, context) {
    const { contactUpdates } = config;
    const { contactId } = context;
    
    if (!contactId) {
      throw new Error('NO_CONTACT');
    }
    
    if (!contactUpdates || Object.keys(contactUpdates).length === 0) {
      return { success: true, updated: false };
    }
    
    // Filter allowed fields
    const allowedFields = ['name', 'email', 'notes', 'customFields'];
    const filteredUpdates = {};
    
    for (const [key, value] of Object.entries(contactUpdates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }
    
    await Contact.findByIdAndUpdate(contactId, filteredUpdates);
    
    return { 
      success: true, 
      updated: true,
      fields: Object.keys(filteredUpdates)
    };
  },
  
  /**
   * Add internal note to conversation
   */
  async add_note(config, context) {
    const { noteContent } = config;
    const { workspaceId, conversationId } = context;
    
    if (!conversationId) {
      throw new Error('NO_CONVERSATION');
    }
    
    // Create internal note message
    await Message.create({
      workspace: workspaceId,
      conversation: conversationId,
      type: 'internal_note',
      content: noteContent,
      direction: 'internal',
      isInternalNote: true,
      metadata: {
        createdBy: 'automation'
      }
    });
    
    return { success: true };
  },
  
  /**
   * Delay execution (for chained actions)
   */
  async delay(config, context) {
    const { delaySeconds, delayMinutes, delayHours, duration } = config;
    
    let totalMs = 0;
    if (delaySeconds) totalMs += delaySeconds * 1000;
    if (delayMinutes) totalMs += delayMinutes * 60 * 1000;
    if (delayHours) totalMs += delayHours * 60 * 60 * 1000;
    if (duration) totalMs += duration * 1000; // Legacy: duration in seconds
    
    if (totalMs > 0 && totalMs <= 30000) {
      // Only do inline delay for up to 30 seconds
      await new Promise(resolve => setTimeout(resolve, totalMs));
    }
    
    return { 
      success: true, 
      delayedMs: totalMs 
    };
  },
  
  /**
   * Close conversation
   */
  async close_conversation(config, context) {
    const { conversationId } = context;
    
    if (!conversationId) {
      throw new Error('NO_CONVERSATION');
    }
    
    await Conversation.findByIdAndUpdate(conversationId, {
      status: 'closed',
      closedAt: new Date(),
      closedBy: null // Automation
    });
    
    return { success: true };
  },
  
  /**
   * Mark conversation as resolved
   */
  async mark_as_resolved(config, context) {
    const { conversationId } = context;
    
    if (!conversationId) {
      throw new Error('NO_CONVERSATION');
    }
    
    await Conversation.findByIdAndUpdate(conversationId, {
      status: 'resolved',
      resolvedAt: new Date()
    });
    
    return { success: true };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute a single action
 */
async function executeAction(action, context) {
  const startTime = Date.now();
  const actionType = action.type;
  
  const handler = actionHandlers[actionType];
  if (!handler) {
    return {
      status: 'FAILED',
      error: `Unknown action type: ${actionType}`,
      durationMs: Date.now() - startTime
    };
  }
  
  try {
    const result = await handler(action.config || action, context);
    return {
      status: 'SUCCESS',
      result,
      durationMs: Date.now() - startTime
    };
  } catch (error) {
    logger.error(`[ActionExecutor] Action ${actionType} failed:`, error);
    
    // Map known errors to failure reasons
    const errorMap = {
      'TEMPLATE_NOT_FOUND': 'TEMPLATE_NOT_FOUND',
      'TEMPLATE_NOT_APPROVED': 'TEMPLATE_NOT_APPROVED',
      'INVALID_PHONE': 'INVALID_PHONE',
      'NO_24H_WINDOW': 'NO_24H_WINDOW',
      'NO_CONVERSATION': 'RESOURCE_NOT_FOUND',
      'NO_CONTACT': 'RESOURCE_NOT_FOUND',
      'DEAL_NOT_FOUND': 'RESOURCE_NOT_FOUND',
      'PIPELINE_NOT_FOUND': 'RESOURCE_NOT_FOUND',
      'INVALID_STAGE': 'RESOURCE_NOT_FOUND',
      'NO_AVAILABLE_AGENTS': 'RESOURCE_NOT_FOUND'
    };
    
    return {
      status: 'FAILED',
      error: error.message,
      failureReason: errorMap[error.message] || 'ACTION_FAILED',
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * Execute all actions in a rule
 */
async function executeActions(actions, context, isDryRun = false) {
  const results = [];
  let overallStatus = 'SUCCESS';
  
  // Sort actions by order
  const sortedActions = [...actions].sort((a, b) => (a.order || 0) - (b.order || 0));
  
  for (let i = 0; i < sortedActions.length; i++) {
    const action = sortedActions[i];
    
    if (isDryRun) {
      // Dry run - don't actually execute
      results.push({
        actionType: action.type,
        actionIndex: i,
        status: 'SKIPPED',
        result: { dryRun: true },
        durationMs: 0
      });
      continue;
    }
    
    const result = await executeAction(action, context);
    
    results.push({
      actionType: action.type,
      actionIndex: i,
      ...result
    });
    
    // Update overall status
    if (result.status === 'FAILED') {
      if (overallStatus === 'SUCCESS') {
        overallStatus = 'PARTIAL';
      }
      
      // Check if we should continue on failure
      if (!action.continueOnFailure) {
        overallStatus = 'FAILED';
        break;
      }
    }
  }
  
  // If all actions failed, mark as FAILED
  if (results.every(r => r.status === 'FAILED')) {
    overallStatus = 'FAILED';
  }
  
  return {
    status: overallStatus,
    results
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  executeAction,
  executeActions,
  actionHandlers,
  isWithin24hWindow,
  resolveTemplateVariables
};
