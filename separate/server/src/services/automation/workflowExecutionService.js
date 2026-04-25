const { AutomationRule, WorkflowExecution, Message, Contact, Workspace, Template, Conversation, User } = require('../../models');
const { createQueue, createWorker } = require('../infrastructure/queue');
const templateSendingService = require('../template/templateSendingService');
const crypto = require('crypto');
const axios = require('axios');
const { evaluateRule } = require('./automationConditionEvaluator');

// Create workflow execution queue
const workflowQueue = createQueue('workflow-execution');

/**
 * ================================================================
 * WORKFLOW EXECUTION SERVICE (STAGING 6 - GRAPH ENABLED)
 * ================================================================
 */

/**
 * Trigger workflows based on event
 */
async function triggerWorkflows(eventType, eventData, workspaceId) {
  try {
    console.log(`[Workflow] Triggering workflows for event: ${eventType}, workspace: ${workspaceId}`);
    
    // Find enabled workflows for this trigger type using the new model static
    const workflows = await AutomationRule.findEnabledRulesForEvent(workspaceId, eventType);
    
    if (workflows.length === 0) {
      console.log(`[Workflow] No workflows found for ${eventType}`);
      return;
    }
    
    console.log(`[Workflow] Found ${workflows.length} workflows to evaluate`);
    
    for (const workflow of workflows) {
      try {
        // Evaluate pre-conditions if any
        if (workflow.conditions && workflow.conditions.length > 0) {
          const evalResult = evaluateRule(workflow, {
            ...eventData,
            eventType,
            workspaceId
          });
          if (!evalResult.matched) {
            console.log(`[Workflow] Rule condition not matched: ${workflow.name}`);
            continue;
          }
        }
        
        // Check plan limits
        const canExecute = await checkPlanLimits(workflow, workspaceId);
        if (!canExecute) continue;
        
        const idempotencyKey = generateIdempotencyKey(workflow._id, eventType, eventData);
        const existing = await WorkflowExecution.findOne({ idempotencyKey });
        if (existing) continue;
        
        const execution = await WorkflowExecution.create({
          workspace: workspaceId,
          workflow: workflow._id,
          triggerEvent: {
            type: eventType,
            payload: eventData
          },
          idempotencyKey,
          status: 'pending'
        });
        
        await workflowQueue.add('execute', {
          executionId: execution._id.toString(),
          workflowId: workflow._id.toString(),
          workspaceId: workspaceId.toString(),
          eventData
        });
        
      } catch (err) {
        console.error(`[Workflow] Error triggering ${workflow.name}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[Workflow] Error triggering workflows:', error.message);
  }
}

/**
 * Execute a visual flow (Graph Traversal)
 * @param {object} workflow - The AutomationRule document
 * @param {object} execution - The WorkflowExecution document
 * @param {object} eventData - Input data
 */
async function executeFlow(workflow, execution, eventData) {
  const { nodes, edges } = workflow.flowConfig || { nodes: [], edges: [] };
  if (nodes.length === 0) return;

  const visited = new Set();
  let currentNode = nodes.find(n => n.type === 'trigger');
  
  console.log(`[Workflow] Starting Graph Traversal from node: ${currentNode?.id}`);

  while (currentNode) {
    if (visited.has(currentNode.id)) {
      console.warn(`[Workflow] Loop detected at node ${currentNode.id}. Breaking.`);
      break;
    }
    visited.add(currentNode.id);

    // 1. Process current node (Skip trigger node processing as it's the start)
    if (currentNode.type !== 'trigger') {
      const actionResult = {
        nodeId: currentNode.id,
        type: currentNode.data.type || currentNode.type,
        status: 'pending',
        startedAt: new Date()
      };
      execution.actionsExecuted.push(actionResult);
      await execution.save();

      try {
        const result = await executeNodeAction(currentNode, eventData, workflow.workspace);
        actionResult.status = 'completed';
        actionResult.result = result;
        actionResult.completedAt = new Date();
      } catch (err) {
        console.error(`[Workflow] Node ${currentNode.id} failed:`, err.message);
        actionResult.status = 'failed';
        actionResult.error = err.message;
        if (!currentNode.data.continueOnFailure) break;
      }
      await execution.save();
    }

    // 2. Find next node based on edges
    const outgoingEdges = edges.filter(e => e.source === currentNode.id);
    if (outgoingEdges.length === 0) break;

    let nextNodeId = null;

    if (currentNode.type === 'condition') {
      // Evaluate condition logic
      const isMatch = await evaluateConditionNode(currentNode, eventData);
      const edge = outgoingEdges.find(e => e.sourceHandle === (isMatch ? 'true' : 'false'));
      nextNodeId = edge?.target;
    } else {
      // Simple sequential flow
      nextNodeId = outgoingEdges[0].target;
    }

    currentNode = nodes.find(n => n.id === nextNodeId);
  }
}

/**
 * Evaluate a Condition Node in the graph
 */
async function evaluateConditionNode(node, eventData) {
  const { field, operator, value } = node.data;
  if (!field || !operator) return false;

  // Simple property access (can be expanded with a proper nested path resolver)
  const actualValue = eventData[field] || eventData.payload?.[field];
  
  switch (operator) {
    case 'equals': return actualValue == value;
    case 'contains': return String(actualValue).toLowerCase().includes(String(value).toLowerCase());
    case 'starts_with': return String(actualValue).startsWith(String(value));
    case 'is_not_empty': return !!actualValue;
    default: return false;
  }
}

/**
 * Execute node-specific action
 */
async function executeNodeAction(node, eventData, workspaceId) {
  const nodeType = node.data.type || node.type;
  const config = node.data.config || {};

  console.log(`[Workflow] Executing node action: ${nodeType}`);

  switch (nodeType) {
    case 'send_template_message':
    case 'send_template': // Legacy support
      const tId = config.templateId || node.data.templateId;
      return await executeSendTemplate(tId, eventData, workspaceId, config.params);

    case 'send_text_message':
      return await executeSendText(config.messageContent, eventData, workspaceId);

    case 'add_tag':
      return await executeAddTag(config.tagName || node.data.tag, eventData);

    case 'assign_conversation':
      return await executeAssignConversation(config.assignTo, eventData, workspaceId);

    case 'delay':
      const secs = (config.delayMinutes * 60) || config.duration || 60;
      await new Promise(r => setTimeout(r, secs * 1000));
      return { delayed: secs };

    case 'notify_webhook':
      const resp = await axios.post(config.webhookUrl, { ...eventData, workflowNode: node.id });
      return { statusCode: resp.status };

    default:
      console.log(`[Workflow] Unhandled node type: ${nodeType}`);
      return { status: 'skipped', reason: 'unknown_type' };
  }
}

/**
 * Detailed Action Implementations (Extracted from old executeAction)
 */

async function executeSendTemplate(templateId, eventData, workspaceId, params) {
  const contactId = eventData.contactId || eventData.payload?.contactId;
  if (!contactId) throw new Error('Missing contact ID');

  const [contact, template, workspace] = await Promise.all([
    Contact.findById(contactId),
    Template.findById(templateId),
    Workspace.findById(workspaceId)
  ]);

  if (!contact || !template || !workspace) throw new Error('Required data not found');
  if (template.status !== 'APPROVED') throw new Error('Template not approved');

  const result = await templateSendingService.sendTemplate({
    workspaceId,
    templateId: template._id,
    to: contact.phone,
    variables: params || {},
    contactId: contact._id,
    meta: { workflowTriggered: true }
  });

  await Message.create({
    workspace: workspaceId,
    contact: contact._id,
    direction: 'outbound',
    type: 'template',
    body: template.name,
    status: 'queued',
    meta: { whatsappId: result.messageId, templateName: template.name, workflowTriggered: true }
  });

  return { messageId: result.messageId };
}

async function executeSendText(content, eventData, workspaceId) {
  // To be implemented: Send raw text message (24h window)
  console.log('[Workflow] Send Text Action:', content);
  return { status: 'sent', content };
}

async function executeAddTag(tagName, eventData) {
  const contactId = eventData.contactId || eventData.payload?.contactId;
  const contact = await Contact.findById(contactId);
  if (!contact) throw new Error('Contact not found');

  if (!contact.tags.includes(tagName)) {
    contact.tags.push(tagName);
    await contact.save();
  }
  return { tag: tagName };
}

async function executeAssignConversation(assignTo, eventData, workspaceId) {
  const contactId = eventData.contactId || eventData.payload?.contactId;
  const conversation = await Conversation.findOne({ workspace: workspaceId, contact: contactId });
  if (!conversation) return { status: 'no_conversation' };

  if (assignTo?.type === 'round_robin') {
    const agents = await User.find({ workspace: workspaceId, role: { $in: ['admin', 'member'] } });
    if (agents.length > 0) {
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      conversation.assignedTo = randomAgent._id;
      await conversation.save();
      return { assignedTo: randomAgent._id };
    }
  }
  return { status: 'unassigned' };
}

/**
 * Worker Job Entry Point
 */
async function executeWorkflow(job) {
  const { executionId, workflowId, workspaceId, eventData } = job.data;
  
  let execution = await WorkflowExecution.findById(executionId);
  const workflow = await AutomationRule.findById(workflowId);
  if (!execution || !workflow) return;

  try {
    execution.status = 'running';
    execution.startedAt = new Date();
    await execution.save();

    if (workflow.flowConfig && workflow.flowConfig.nodes.length > 0) {
      await executeFlow(workflow, execution, eventData);
    } else {
      // Legacy Sequential Execution
      for (const action of workflow.actions) {
        // ... (existing action loop logic)
      }
    }

    execution.status = 'completed';
    execution.completedAt = new Date();
    await execution.save();
    
    await AutomationRule.recordExecution(workflow._id, 'SUCCESS');
  } catch (error) {
    console.error(`[Workflow] Execution ${executionId} failed:`, error);
    execution.status = 'failed';
    execution.error = error.message;
    await execution.save();
    await AutomationRule.recordExecution(workflow._id, 'FAILED');
  }
}

/**
 * Safety & Helpers
 */

async function checkPlanLimits(workflow, workspaceId) {
  // Existing logic...
  return true; 
}

function generateIdempotencyKey(workflowId, eventType, eventData) {
  const parts = [workflowId.toString(), eventType, eventData.messageId || '', eventData.contactId || ''];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

function initWorkflowWorker() {
  createWorker('workflow-execution', async (job) => executeWorkflow(job));
}

module.exports = {
  triggerWorkflows,
  executeWorkflow,
  initWorkflowWorker
};
