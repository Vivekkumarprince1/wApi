const AutomationRule = require('../models/AutomationRule');
const WorkflowExecution = require('../models/WorkflowExecution');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Workspace = require('../models/Workspace');
const Template = require('../models/Template');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { createQueue, createWorker } = require('./queue');
const templateSendingService = require('./templateSendingService');
const crypto = require('crypto');

// Create workflow execution queue
const workflowQueue = createQueue('workflow-execution');

/**
 * ================================================================
 * WORKFLOW EXECUTION SERVICE
 * ================================================================
 * Handles event-driven workflow automation:
 * - Triggers from webhooks, campaigns, inbox
 * - Idempotency protection
 * - Delay/queue support
 * - Plan limit enforcement
 */

/**
 * Trigger workflows based on event
 * @param {string} eventType - 'message_received', 'status_updated', 'campaign_completed', 'ad_lead'
 * @param {object} eventData - Event-specific data
 * @param {ObjectId} workspaceId - Workspace ID
 */
async function triggerWorkflows(eventType, eventData, workspaceId) {
  try {
    console.log(`[Workflow] Triggering workflows for event: ${eventType}, workspace: ${workspaceId}`);
    
    // Find enabled workflows for this trigger type
    const workflows = await AutomationRule.find({
      workspace: workspaceId,
      enabled: true,
      $or: [
        { trigger: eventType },
        { trigger: 'keyword', $and: [{ 'condition.type': 'keyword' }] }, // Match keywords on message_received
        { trigger: 'tag_added' } // Can be triggered programmatically
      ]
    });
    
    if (workflows.length === 0) {
      console.log(`[Workflow] No workflows found for ${eventType}`);
      return;
    }
    
    console.log(`[Workflow] Found ${workflows.length} workflows to evaluate`);
    
    // Evaluate each workflow
    for (const workflow of workflows) {
      try {
        // Check if condition matches
        const matches = await evaluateCondition(workflow, eventType, eventData);
        
        if (!matches) {
          console.log(`[Workflow] Condition not matched for workflow: ${workflow.name}`);
          continue;
        }
        
        // Check plan limits
        const canExecute = await checkPlanLimits(workflow, workspaceId);
        if (!canExecute) {
          console.log(`[Workflow] Plan limit exceeded for workflow: ${workflow.name}`);
          continue;
        }
        
        // Create idempotency key
        const idempotencyKey = generateIdempotencyKey(workflow._id, eventType, eventData);
        
        // Check if already executed
        const existing = await WorkflowExecution.findOne({ idempotencyKey });
        if (existing) {
          console.log(`[Workflow] Already executed (idempotency): ${workflow.name}`);
          continue;
        }
        
        // Create execution record
        const execution = await WorkflowExecution.create({
          workspace: workspaceId,
          workflow: workflow._id,
          triggerEvent: {
            type: eventType,
            messageId: eventData.messageId,
            contactId: eventData.contactId,
            campaignId: eventData.campaignId,
            adId: eventData.adId,
            payload: eventData
          },
          idempotencyKey,
          status: 'pending'
        });
        
        console.log(`[Workflow] Created execution: ${execution._id} for workflow: ${workflow.name}`);
        
        // Queue for execution
        await workflowQueue.add('execute', {
          executionId: execution._id.toString(),
          workflowId: workflow._id.toString(),
          workspaceId: workspaceId.toString(),
          eventData
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        });
        
      } catch (err) {
        console.error(`[Workflow] Error processing workflow ${workflow.name}:`, err.message);
      }
    }
    
  } catch (error) {
    console.error('[Workflow] Error triggering workflows:', error.message);
  }
}

/**
 * Evaluate workflow condition against event data
 */
async function evaluateCondition(workflow, eventType, eventData) {
  const condition = workflow.condition || {};
  
  // No condition = always match
  if (!condition.type || Object.keys(condition).length === 0) {
    return true;
  }
  
  // Keyword matching
  if (condition.type === 'keyword' && eventData.messageBody) {
    const keywords = condition.keywords || [];
    const messageBody = (eventData.messageBody || '').toLowerCase();
    
    const matchMode = condition.matchMode || 'contains'; // 'contains', 'exact', 'starts_with'
    
    return keywords.some(keyword => {
      const kw = keyword.toLowerCase();
      if (matchMode === 'exact') {
        return messageBody === kw;
      } else if (matchMode === 'starts_with') {
        return messageBody.startsWith(kw);
      } else {
        return messageBody.includes(kw);
      }
    });
  }
  
  // Tag matching
  if (condition.type === 'tag' && eventData.contactId) {
    const contact = await Contact.findById(eventData.contactId);
    if (!contact) return false;
    
    const tags = condition.tags || [];
    const contactTags = contact.tags || [];
    
    // Match if contact has ANY of the specified tags
    return tags.some(tag => contactTags.includes(tag));
  }
  
  // Ad source matching
  if (condition.type === 'ad_source' && eventData.adId) {
    const adIds = condition.adIds || [];
    return adIds.includes(eventData.adId.toString());
  }
  
  // Message type matching
  if (condition.type === 'message_type' && eventData.messageType) {
    const messageTypes = condition.messageTypes || [];
    return messageTypes.includes(eventData.messageType);
  }
  
  // Default: match
  return true;
}

/**
 * Check plan limits
 */
async function checkPlanLimits(workflow, workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return false;
    
    // Check daily execution limit (if set on workflow)
    if (workflow.dailyExecutionLimit) {
      const now = new Date();
      const resetAt = workflow.dailyExecutionResetAt;
      
      // Reset counter if past reset time
      if (!resetAt || resetAt < now.setHours(0, 0, 0, 0)) {
        workflow.dailyExecutionCount = 0;
        workflow.dailyExecutionResetAt = new Date(now.setHours(23, 59, 59, 999));
        await workflow.save();
      }
      
      // Check if limit exceeded
      if (workflow.dailyExecutionCount >= workflow.dailyExecutionLimit) {
        return false;
      }
    }
    
    // Check workspace plan limits (from paymentController plan configs)
    const plan = workspace.plan || 'free';
    const PLAN_LIMITS = {
      free: { maxExecutionsPerDay: 100 },
      basic: { maxExecutionsPerDay: 1000 },
      premium: { maxExecutionsPerDay: 10000 },
      enterprise: { maxExecutionsPerDay: 100000 }
    };
    
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    
    // Count today's executions
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const todayExecutions = await WorkflowExecution.countDocuments({
      workspace: workspaceId,
      createdAt: { $gte: startOfDay },
      status: { $in: ['completed', 'running'] }
    });
    
    if (todayExecutions >= limits.maxExecutionsPerDay) {
      console.warn(`[Workflow] Daily execution limit exceeded for workspace ${workspaceId}: ${todayExecutions}/${limits.maxExecutionsPerDay}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[Workflow] Error checking plan limits:', error.message);
    return false; // Fail closed
  }
}

/**
 * Generate idempotency key
 */
function generateIdempotencyKey(workflowId, eventType, eventData) {
  const parts = [
    workflowId.toString(),
    eventType,
    eventData.messageId?.toString() || '',
    eventData.contactId?.toString() || '',
    eventData.campaignId?.toString() || '',
    eventData.adId?.toString() || ''
  ];
  
  const hash = crypto.createHash('sha256')
    .update(parts.join('|'))
    .digest('hex');
  
  return hash;
}

/**
 * Execute workflow (worker job)
 */
async function executeWorkflow(job) {
  const { executionId, workflowId, workspaceId, eventData } = job.data;
  
  console.log(`[Workflow] Executing workflow ${workflowId}, execution: ${executionId}`);
  
  let execution = await WorkflowExecution.findById(executionId);
  if (!execution) {
    throw new Error('Execution not found');
  }
  
  const workflow = await AutomationRule.findById(workflowId);
  if (!workflow) {
    execution.status = 'failed';
    execution.error = 'Workflow not found';
    await execution.save();
    throw new Error('Workflow not found');
  }
  
  try {
    execution.status = 'running';
    execution.startedAt = new Date();
    await execution.save();
    
    // Execute actions sequentially
    for (const action of workflow.actions) {
      const actionResult = {
        type: action.type,
        status: 'pending',
        startedAt: new Date()
      };
      
      execution.actionsExecuted.push(actionResult);
      await execution.save();
      
      try {
        const result = await executeAction(action, eventData, workspaceId);
        
        actionResult.status = 'completed';
        actionResult.completedAt = new Date();
        actionResult.result = result;
        
      } catch (actionErr) {
        console.error(`[Workflow] Action ${action.type} failed:`, actionErr.message);
        actionResult.status = 'failed';
        actionResult.error = actionErr.message;
      }
      
      await execution.save();
    }
    
    // Mark execution complete
    execution.status = 'completed';
    execution.completedAt = new Date();
    await execution.save();
    
    // Update workflow stats
    workflow.executionCount += 1;
    workflow.successCount += 1;
    workflow.lastExecutedAt = new Date();
    workflow.dailyExecutionCount += 1;
    await workflow.save();
    
    console.log(`[Workflow] Execution ${executionId} completed successfully`);
    
  } catch (error) {
    console.error(`[Workflow] Execution ${executionId} failed:`, error.message);
    
    execution.status = 'failed';
    execution.error = error.message;
    execution.errorStack = error.stack;
    execution.completedAt = new Date();
    await execution.save();
    
    // Update failure count
    workflow.failureCount += 1;
    await workflow.save();
    
    throw error;
  }
}

/**
 * Execute individual action
 */
async function executeAction(action, eventData, workspaceId) {
  const actionType = action.type;
  
  console.log(`[Workflow] Executing action: ${actionType}`);
  
  // Send template message
  if (actionType === 'send_template') {
    const { templateId, params } = action;
    
    if (!eventData.contactId) {
      throw new Error('No contact ID for send_template action');
    }
    
    const contact = await Contact.findById(eventData.contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }
    
    const template = await Template.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // ✅ Template must be APPROVED before sending via automation
    // Prevents sending unapproved templates (matches campaign/auto-reply behavior)
    if (template.status !== 'APPROVED') {
      throw new Error(`Template not approved for sending (status: ${template.status}). User must approve template first.`);
    }
    
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Send template via BSP template sending service (centralized token)
    const result = await templateSendingService.sendTemplate({
      workspaceId,
      templateId: template._id,
      to: contact.phone,
      variables: params || {},
      contactId: contact._id,
      meta: { workflowTriggered: true }
    });
    
    // Store message
    await Message.create({
      workspace: workspaceId,
      contact: contact._id,
      direction: 'outbound',
      type: 'template',
      body: template.name,
      status: 'sent',
      meta: {
        whatsappId: result.messageId,
        templateName: template.name,
        workflowTriggered: true
      }
    });
    
    return { messageId: result.messageId, status: 'sent' };
  }
  
  // Assign agent
  if (actionType === 'assign_agent') {
    const { agentId, assignmentType } = action;
    
    if (!eventData.contactId) {
      throw new Error('No contact ID for assign_agent action');
    }
    
    let assignedAgentId = agentId;
    
    // Round-robin assignment
    if (assignmentType === 'round-robin' && !agentId) {
      const agents = await User.find({ workspace: workspaceId, role: { $in: ['admin', 'member'] } });
      if (agents.length === 0) {
        throw new Error('No agents available');
      }
      
      // Simple round-robin (can be improved with assignment tracking)
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      assignedAgentId = randomAgent._id;
    }
    
    // Update conversation
    const conversation = await Conversation.findOne({
      workspace: workspaceId,
      contact: eventData.contactId
    });
    
    if (conversation) {
      conversation.assignedTo = assignedAgentId;
      await conversation.save();
      return { conversationId: conversation._id, assignedTo: assignedAgentId };
    }
    
    return { status: 'no_conversation' };
  }
  
  // Add tag
  if (actionType === 'add_tag') {
    const { tag } = action;
    
    if (!eventData.contactId) {
      throw new Error('No contact ID for add_tag action');
    }
    
    const contact = await Contact.findById(eventData.contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }
    
    if (!contact.tags) contact.tags = [];
    if (!contact.tags.includes(tag)) {
      contact.tags.push(tag);
      await contact.save();
    }
    
    return { tag, contactId: contact._id };
  }
  
  // Remove tag
  if (actionType === 'remove_tag') {
    const { tag } = action;
    
    if (!eventData.contactId) {
      throw new Error('No contact ID for remove_tag action');
    }
    
    const contact = await Contact.findById(eventData.contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }
    
    if (contact.tags) {
      contact.tags = contact.tags.filter(t => t !== tag);
      await contact.save();
    }
    
    return { tag, contactId: contact._id };
  }
  
  // Delay
  if (actionType === 'delay') {
    const { duration } = action; // duration in seconds
    
    console.log(`[Workflow] Delaying for ${duration} seconds`);
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    
    return { delayed: duration };
  }
  
  // Webhook
  if (actionType === 'webhook') {
    const { url, method = 'POST', headers = {}, body } = action;
    
    const axios = require('axios');
    const response = await axios({
      method,
      url,
      headers,
      data: body || eventData
    });
    
    return { statusCode: response.status, data: response.data };
  }
  
  throw new Error(`Unknown action type: ${actionType}`);
}

/**
 * Initialize workflow worker
 */
function initWorkflowWorker() {
  console.log('[Workflow] Initializing workflow worker');
  
  createWorker('workflow-execution', async (job) => {
    return await executeWorkflow(job);
  });
  
  console.log('[Workflow] Workflow worker initialized');
}

module.exports = {
  triggerWorkflows,
  executeWorkflow,
  initWorkflowWorker
};
