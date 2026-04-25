/**
 * Automation Engine Service - Stage 6 Automation Engine
 * 
 * Main orchestrator that:
 * 1. Listens to automation events
 * 2. Fetches matching rules
 * 3. Evaluates conditions
 * 4. Enforces safety guards
 * 5. Executes actions
 * 6. Records execution logs
 */

const { AutomationRule, AutomationExecution, AutomationAuditLog, Contact, Conversation } = require('../../models');
const { automationEvents, AUTOMATION_EVENTS } = require('./automationEventEmitter');
const { evaluateRule } = require('./automationConditionEvaluator');
const { runSafetyChecks, incrementCounters } = require('./automationSafetyGuards');
const { executeActions } = require('./automationActionExecutor');
const workflowExecutionService = require('./workflowExecutionService');
const aiIntentMatcher = require('../ai/aiIntentMatcher');
const logger = require('../../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE STATE
// ═══════════════════════════════════════════════════════════════════════════

let engineStarted = false;
const processingQueue = new Map(); // Prevent duplicate processing

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT ENRICHMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Enrich event context with full data for condition evaluation
 */
async function enrichContext(event) {
  const context = {
    ...event,
    workspaceId: event.workspaceId,
    conversationId: event.conversationId,
    contactId: event.contactId,
    messageId: event.messageId,
    timestamp: event.timestamp,
    eventType: event.type
  };
  
  // Load contact data
  if (event.contactId) {
    try {
      const contact = await Contact.findById(event.contactId)
        .select('phone name email tags source customFields')
        .lean();
      if (contact) {
        context.contact = contact;
      }
    } catch (error) {
      logger.warn('[AutomationEngine] Failed to load contact:', error.message);
    }
  }
  
  // Load conversation data
  if (event.conversationId) {
    try {
      const conversation = await Conversation.findById(event.conversationId)
        .select('status assignedTo source channel lastCustomerMessageAt createdAt')
        .lean();
      if (conversation) {
        context.conversation = conversation;
      }
    } catch (error) {
      logger.warn('[AutomationEngine] Failed to load conversation:', error.message);
    }
  }
  
  // Merge metadata
  if (event.metadata) {
    context.metadata = event.metadata;
    context.message = event.metadata.message;
    context.channel = event.metadata.channel;
    context.source = event.metadata.source;
  }
  
  return context;
}

/**
 * Build context snapshot for execution log
 */
function buildContextSnapshot(context) {
  return {
    contact: context.contact ? {
      phone: context.contact.phone,
      name: context.contact.name,
      tags: context.contact.tags || []
    } : null,
    conversation: context.conversation ? {
      status: context.conversation.status,
      assignedTo: context.conversation.assignedTo,
      source: context.conversation.source
    } : null,
    message: context.message ? {
      type: context.message.type,
      content: context.message.content || context.message.text,
      direction: context.message.direction
    } : null,
    metadata: context.metadata
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE PROCESSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Process a single rule against an event
 */
async function processRule(rule, context, isDryRun = false) {
  const executionStart = Date.now();
  
  // Create execution record
  const execution = new AutomationExecution({
    rule: rule._id,
    ruleName: rule.name,
    workspace: context.workspaceId,
    triggerEvent: context.eventType,
    conversation: context.conversationId,
    contact: context.contactId,
    message: context.messageId,
    contextSnapshot: buildContextSnapshot(context),
    startedAt: new Date(),
    isDryRun
  });
  
  try {
    // 1. Run safety checks
    if (!isDryRun) {
      const safetyResult = await runSafetyChecks(rule, {
        workspaceId: context.workspaceId,
        contactId: context.contactId,
        conversationId: context.conversationId
      });
      
      if (!safetyResult.allowed) {
        execution.status = 'SKIPPED';
        execution.skipReason = safetyResult.skipReason;
        execution.skipDetails = safetyResult.skipDetails;
        execution.durationMs = Date.now() - executionStart;
        await execution.save();
        
        // Record skip in rule stats
        await AutomationRule.recordExecution(rule._id, 'SKIPPED');
        
        // Also log to AuditLog
        await AutomationAuditLog.logExecution({
          workspaceId: context.workspaceId,
          ruleId: rule._id,
          executionId: execution._id,
          conversationId: context.conversationId,
          contactId: context.contactId,
          triggerType: context.eventType,
          triggerMetadata: context.metadata,
          status: 'SKIPPED',
          reason: safetyResult.skipReason,
          notes: safetyResult.skipDetails,
          duration: execution.durationMs
        });

        logger.debug(`[AutomationEngine] Rule ${rule.name} skipped: ${safetyResult.skipReason}`);
        return { status: 'SKIPPED', reason: safetyResult.skipReason };
      }
    }
    
    // 2. Evaluate conditions
    const evalResult = evaluateRule(rule, context);
    if (!evalResult.matched) {
      execution.status = 'SKIPPED';
      execution.skipReason = evalResult.reason;
      execution.skipDetails = evalResult.details;
      execution.durationMs = Date.now() - executionStart;
      await execution.save();
      
      if (!isDryRun) {
        await AutomationRule.recordExecution(rule._id, 'SKIPPED');

        // Also log to AuditLog
        await AutomationAuditLog.logExecution({
          workspaceId: context.workspaceId,
          ruleId: rule._id,
          executionId: execution._id,
          conversationId: context.conversationId,
          contactId: context.contactId,
          triggerType: context.eventType,
          triggerMetadata: context.metadata,
          status: 'SKIPPED',
          reason: evalResult.reason,
          notes: evalResult.details,
          duration: execution.durationMs,
          conditionsEvaluated: evalResult.evaluations || []
        });
      }
      
      logger.debug(`[AutomationEngine] Rule ${rule.name} conditions not met`);
      return { status: 'SKIPPED', reason: evalResult.reason };
    }
    
    // 3. Execute actions (Switch between Graph and Legacy)
    let actionResult = { status: 'COMPLETED', results: [] };
    
    if (rule.flowConfig && rule.flowConfig.nodes?.length > 0) {
      // VISUAL FLOW ENGINE (Stage 6)
      logger.info(`[AutomationEngine] Running Visual Flow for ${rule.name}`);
      await workflowExecutionService.executeFlow(rule, execution, context);
      
      // Map execution results to match the expected format below
      actionResult.status = execution.status || 'COMPLETED';
      actionResult.results = execution.actionsExecuted.map(a => ({
        actionType: a.type,
        status: a.status === 'completed' ? 'SUCCESS' : 'FAILED',
        result: a.result,
        error: a.error,
        durationMs: a.completedAt ? (new Date(a.completedAt) - new Date(a.startedAt)) : 0
      }));
    } else {
      // LEGACY SEQUENTIAL ENGINE
      actionResult = await executeActions(rule.actions, context, isDryRun);
      execution.actionResults = actionResult.results;
      execution.actionsExecutedCount = actionResult.results.length; // renamed from actionsExecuted to avoided conflict with execution.actionsExecuted array
      execution.actionsSucceeded = actionResult.results.filter(r => r.status === 'SUCCESS').length;
      execution.actionsFailed = actionResult.results.filter(r => r.status === 'FAILED').length;
    }

    // 4. Record results
    execution.status = isDryRun ? 'SKIPPED' : actionResult.status;
    if (isDryRun) {
      execution.skipReason = 'DRY_RUN';
    }
    execution.completedAt = new Date();
    execution.durationMs = Date.now() - executionStart;
    
    // Set failure reason if failed
    if (actionResult.status === 'FAILED') {
      const failedAction = actionResult.results.find(r => r.status === 'FAILED');
      execution.failureReason = failedAction?.failureReason || 'ACTION_FAILED';
      execution.failureDetails = failedAction?.error;
    }
    
    await execution.save();
    
    // 5. Update rule stats
    if (!isDryRun) {
      await AutomationRule.recordExecution(rule._id, actionResult.status);
      incrementCounters(context.workspaceId);

      // Also log to AuditLog
      await AutomationAuditLog.logExecution({
        workspaceId: context.workspaceId,
        ruleId: rule._id,
        executionId: execution._id,
        conversationId: context.conversationId,
        contactId: context.contactId,
        triggerType: context.eventType,
        triggerMetadata: context.metadata,
        status: actionResult.status,
        reason: actionResult.status === 'FAILED' ? execution.failureReason : null,
        errorMessage: execution.failureDetails,
        duration: execution.durationMs,
        actionsExecuted: actionResult.results.map(r => ({
          actionType: r.actionType,
          status: r.status,
          result: r.result,
          error: r.error,
          executedAt: new Date(),
          duration: r.durationMs
        }))
      });
    }
    
    logger.info(`[AutomationEngine] Rule ${rule.name} executed: ${actionResult.status}`, {
      ruleId: rule._id,
      executionId: execution._id,
      actionsExecuted: execution.actionsExecuted,
      duration: execution.durationMs
    });
    
    return { 
      status: actionResult.status, 
      executionId: execution._id,
      actionResults: actionResult.results 
    };
    
  } catch (error) {
    // Record failure
    execution.status = 'FAILED';
    execution.failureReason = 'INTERNAL_ERROR';
    execution.failureDetails = error.message;
    execution.completedAt = new Date();
    execution.durationMs = Date.now() - executionStart;
    await execution.save();
    
    if (!isDryRun) {
      await AutomationRule.recordExecution(rule._id, 'FAILED');
    }
    
    logger.error(`[AutomationEngine] Rule ${rule.name} failed:`, error);
    
    return { 
      status: 'FAILED', 
      error: error.message,
      executionId: execution._id 
    };
  }
}

/**
 * Process all matching rules for an event
 */
async function processEvent(event) {
  // Prevent duplicate processing
  const eventKey = `${event.workspaceId}:${event.type}:${event.conversationId || event.contactId}:${event.timestamp.getTime()}`;
  if (processingQueue.has(eventKey)) {
    logger.debug('[AutomationEngine] Skipping duplicate event:', eventKey);
    return;
  }
  
  processingQueue.set(eventKey, true);
  setTimeout(() => processingQueue.delete(eventKey), 5000); // Clear after 5s
  
  try {
    // 1. Enrich context
    const context = await enrichContext(event);
    
    // 2. Find matching rules
    const rules = await AutomationRule.findEnabledRulesForEvent(
      event.workspaceId, 
      event.type
    );
    
    if (rules.length === 0) {
      logger.debug(`[AutomationEngine] No rules found for event ${event.type}`);
      
      // ═══════════════════════════════════════════════════════════════════
      // AI INTENT MATCH FALLBACK (Stage 6 Smart Layer)
      // ═══════════════════════════════════════════════════════════════════
      if (['message_received', 'customer.message.received'].includes(event.type)) {
        const workspace = await Workspace.findById(event.workspaceId).select('automationSettings plan');
        
        if (workspace?.automationSettings?.aiIntentMatchEnabled) {
          logger.info(`[AutomationEngine] 🤖 Fallback to AI Intent Match for message: "${context.message?.content || ''}"`);
          
          const matchedRule = await aiIntentMatcher.matchIntent(
            event.workspaceId,
            context.message?.content || context.message?.text || '',
            event.conversationId,
            event.contactId
          );

          if (matchedRule) {
            logger.info(`[AutomationEngine] 🧠 AI successfully matched query to rule: [${matchedRule.name}]`);
            // Execute the single matched rule
            const result = await processRule(matchedRule, context);
            return [{ ruleId: matchedRule._id, ruleName: matchedRule.name, ...result }];
          }
        }
      }
      
      return;
    }
    
    logger.debug(`[AutomationEngine] Found ${rules.length} rules for event ${event.type}`);
    
    // 3. Process each rule
    const results = [];
    for (const rule of rules) {
      const result = await processRule(rule, context);
      results.push({ ruleId: rule._id, ruleName: rule.name, ...result });
      
      // Small delay between rules to prevent overwhelming
      if (rules.length > 1) {
        await new Promise(r => setTimeout(r, 50));
      }
    }
    
    return results;
    
  } catch (error) {
    logger.error('[AutomationEngine] Event processing failed:', error);
  } finally {
    processingQueue.delete(eventKey);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DRY RUN / TESTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Test a rule without executing actions (dry run)
 */
async function testRule(ruleId, testContext) {
  const rule = await AutomationRule.findById(ruleId);
  if (!rule) {
    throw new Error('Rule not found');
  }
  
  // Enrich test context
  const context = await enrichContext({
    workspaceId: rule.workspace,
    type: rule.getEffectiveTriggerEvent(),
    ...testContext
  });
  
  // Process with dry run flag
  return processRule(rule, context, true);
}

/**
 * Simulate event processing without actions
 */
async function simulateEvent(event) {
  const context = await enrichContext(event);
  
  const rules = await AutomationRule.findEnabledRulesForEvent(
    event.workspaceId, 
    event.type
  );
  
  const results = [];
  for (const rule of rules) {
    // Only evaluate conditions, don't execute
    const evalResult = evaluateRule(rule, context);
    const safetyResult = await runSafetyChecks(rule, {
      workspaceId: event.workspaceId,
      contactId: event.contactId,
      conversationId: event.conversationId
    });
    
    results.push({
      ruleId: rule._id,
      ruleName: rule.name,
      conditionsMatched: evalResult.matched,
      conditionDetails: evalResult.details,
      safetyCheckPassed: safetyResult.allowed,
      safetyDetails: safetyResult.skipReason,
      wouldExecute: evalResult.matched && safetyResult.allowed,
      actions: rule.actions.map(a => a.type)
    });
  }
  
  return {
    event: event.type,
    matchedRules: results.filter(r => r.wouldExecute).length,
    results
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Start the automation engine
 */
function startEngine() {
  if (engineStarted) {
    logger.warn('[AutomationEngine] Engine already started');
    return;
  }
  
  // Subscribe to all automation events
  automationEvents.on('automation.event', async (event) => {
    try {
      await processEvent(event);
    } catch (error) {
      logger.error('[AutomationEngine] Event handler error:', error);
    }
  });
  
  engineStarted = true;
  logger.info('[AutomationEngine] ✅ Automation engine started');
}

/**
 * Stop the automation engine
 */
function stopEngine() {
  automationEvents.removeAllListeners('automation.event');
  engineStarted = false;
  logger.info('[AutomationEngine] Automation engine stopped');
}

/**
 * Check if engine is running
 */
function isEngineRunning() {
  return engineStarted;
}

/**
 * Get engine status
 */
function getEngineStatus() {
  const safetyGuards = require('./automationSafetyGuards');
  
  return {
    running: engineStarted,
    eventsEnabled: automationEvents.isEnabled(),
    eventStats: automationEvents.getStats(),
    safetyStatus: safetyGuards.getSafetyStatus(),
    processingQueueSize: processingQueue.size
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // Engine lifecycle
  startEngine,
  stopEngine,
  isEngineRunning,
  getEngineStatus,
  
  // Event processing
  processEvent,
  processRule,
  enrichContext,
  
  // Testing
  testRule,
  simulateEvent
};
