/**
 * Automation Rule Matcher - Stage 6 Automation Engine
 *
 * Matches automation rules against events and evaluates conditions.
 * This service handles the core rule matching logic.
 */

const AutomationRule = require('../models/AutomationRule');
const { evaluateRule } = require('./automationConditionEvaluator');
const { runSafetyChecks } = require('./automationSafetyGuards');
const { logger } = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// RULE MATCHING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find all enabled rules for a workspace that match the event type
 */
async function findMatchingRules(workspaceId, eventType) {
  try {
    const rules = await AutomationRule.find({
      workspaceId,
      enabled: true,
      'trigger.event': eventType
    }).sort({ createdAt: 1 }); // Execute in creation order

    logger.debug(`[RuleMatcher] Found ${rules.length} rules for event ${eventType} in workspace ${workspaceId}`);
    return rules;
  } catch (error) {
    logger.error('[RuleMatcher] Failed to find matching rules:', error);
    return [];
  }
}

/**
 * Match a single rule against an event
 */
async function matchRule(rule, event, context) {
  try {
    // 1. Check trigger filters
    if (!matchesTriggerFilters(rule.trigger, event)) {
      return { matches: false, reason: 'trigger_filters_not_met' };
    }

    // 2. Evaluate conditions
    const conditionResult = await evaluateRule(rule, context);
    if (!conditionResult.passes) {
      return { matches: false, reason: 'conditions_not_met', details: conditionResult.details };
    }

    // 3. Run safety checks
    const safetyResult = await runSafetyChecks(rule, event, context);
    if (safetyResult.skip) {
      return { matches: false, reason: safetyResult.skipReason, details: safetyResult.details };
    }

    return { matches: true };

  } catch (error) {
    logger.error(`[RuleMatcher] Rule ${rule.name} matching failed:`, error);
    return { matches: false, reason: 'evaluation_error', error: error.message };
  }
}

/**
 * Check if event matches trigger filters
 */
function matchesTriggerFilters(trigger, event) {
  // Check event type
  if (trigger.event !== event.type) {
    return false;
  }

  // Check filters if any
  if (trigger.filters) {
    for (const [key, value] of Object.entries(trigger.filters)) {
      const eventValue = event[key];
      if (eventValue !== value) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Match all rules for an event and return those that should execute
 */
async function matchAllRules(workspaceId, event, context) {
  const matchingRules = [];

  // Find rules that match the event type
  const rules = await findMatchingRules(workspaceId, event.type);

  // Evaluate each rule
  for (const rule of rules) {
    const result = await matchRule(rule, event, context);

    if (result.matches) {
      matchingRules.push({
        rule,
        context,
        metadata: result.metadata
      });
    } else {
      logger.debug(`[RuleMatcher] Rule ${rule.name} skipped: ${result.reason}`, result.details);
    }
  }

  return matchingRules;
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate rule configuration
 */
function validateRule(rule) {
  const errors = [];

  // Validate trigger
  if (!rule.trigger || !rule.trigger.event) {
    errors.push('Trigger event is required');
  }

  // Validate conditions
  if (rule.conditions && Array.isArray(rule.conditions)) {
    for (let i = 0; i < rule.conditions.length; i++) {
      const condition = rule.conditions[i];
      if (!condition.field || !condition.operator || condition.value === undefined) {
        errors.push(`Condition ${i + 1}: field, operator, and value are required`);
      }
    }
  }

  // Validate actions
  if (!rule.actions || !Array.isArray(rule.actions) || rule.actions.length === 0) {
    errors.push('At least one action is required');
  } else {
    for (let i = 0; i < rule.actions.length; i++) {
      const action = rule.actions[i];
      if (!action.type) {
        errors.push(`Action ${i + 1}: type is required`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  findMatchingRules,
  matchRule,
  matchAllRules,
  validateRule,
  matchesTriggerFilters
};