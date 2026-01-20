/**
 * Automation Condition Evaluator - Stage 6 Automation Engine
 * 
 * Evaluates conditions against event context to determine if a rule should fire.
 */

const { logger } = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// FIELD VALUE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract value from nested object path
 * e.g., 'contact.tags' from { contact: { tags: ['vip'] } }
 */
function getNestedValue(obj, path) {
  if (!path || !obj) return undefined;
  
  const parts = path.split('.');
  let value = obj;
  
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR EVALUATORS
// ═══════════════════════════════════════════════════════════════════════════

const operators = {
  /**
   * Exact equality
   */
  equals: (fieldValue, conditionValue) => {
    if (Array.isArray(fieldValue)) {
      return fieldValue.includes(conditionValue);
    }
    return String(fieldValue).toLowerCase() === String(conditionValue).toLowerCase();
  },
  
  /**
   * Not equal
   */
  not_equals: (fieldValue, conditionValue) => {
    return !operators.equals(fieldValue, conditionValue);
  },
  
  /**
   * String contains or array includes
   */
  contains: (fieldValue, conditionValue) => {
    if (Array.isArray(fieldValue)) {
      // Array includes check (case-insensitive for strings)
      return fieldValue.some(v => 
        String(v).toLowerCase() === String(conditionValue).toLowerCase()
      );
    }
    if (typeof fieldValue === 'string') {
      return fieldValue.toLowerCase().includes(String(conditionValue).toLowerCase());
    }
    return false;
  },
  
  /**
   * String doesn't contain or array doesn't include
   */
  not_contains: (fieldValue, conditionValue) => {
    return !operators.contains(fieldValue, conditionValue);
  },
  
  /**
   * String starts with
   */
  starts_with: (fieldValue, conditionValue) => {
    if (typeof fieldValue !== 'string') return false;
    return fieldValue.toLowerCase().startsWith(String(conditionValue).toLowerCase());
  },
  
  /**
   * String ends with
   */
  ends_with: (fieldValue, conditionValue) => {
    if (typeof fieldValue !== 'string') return false;
    return fieldValue.toLowerCase().endsWith(String(conditionValue).toLowerCase());
  },
  
  /**
   * Greater than (numeric)
   */
  greater_than: (fieldValue, conditionValue) => {
    const num = parseFloat(fieldValue);
    const threshold = parseFloat(conditionValue);
    if (isNaN(num) || isNaN(threshold)) return false;
    return num > threshold;
  },
  
  /**
   * Less than (numeric)
   */
  less_than: (fieldValue, conditionValue) => {
    const num = parseFloat(fieldValue);
    const threshold = parseFloat(conditionValue);
    if (isNaN(num) || isNaN(threshold)) return false;
    return num < threshold;
  },
  
  /**
   * Field is empty/null/undefined
   */
  is_empty: (fieldValue) => {
    if (fieldValue === null || fieldValue === undefined) return true;
    if (typeof fieldValue === 'string' && fieldValue.trim() === '') return true;
    if (Array.isArray(fieldValue) && fieldValue.length === 0) return true;
    return false;
  },
  
  /**
   * Field is not empty
   */
  is_not_empty: (fieldValue) => {
    return !operators.is_empty(fieldValue);
  },
  
  /**
   * Value in array
   */
  in: (fieldValue, conditionValue) => {
    if (!Array.isArray(conditionValue)) return false;
    const normalizedField = String(fieldValue).toLowerCase();
    return conditionValue.some(v => String(v).toLowerCase() === normalizedField);
  },
  
  /**
   * Value not in array
   */
  not_in: (fieldValue, conditionValue) => {
    return !operators.in(fieldValue, conditionValue);
  },
  
  /**
   * Regex match
   */
  matches_regex: (fieldValue, conditionValue) => {
    if (typeof fieldValue !== 'string') return false;
    try {
      const regex = new RegExp(conditionValue, 'i');
      return regex.test(fieldValue);
    } catch {
      logger.warn('[ConditionEval] Invalid regex:', conditionValue);
      return false;
    }
  },
  
  /**
   * Time within N hours
   */
  time_within: (fieldValue, conditionValue) => {
    const timestamp = new Date(fieldValue);
    if (isNaN(timestamp.getTime())) return false;
    
    const hoursAgo = parseFloat(conditionValue);
    if (isNaN(hoursAgo)) return false;
    
    const cutoff = Date.now() - (hoursAgo * 60 * 60 * 1000);
    return timestamp.getTime() >= cutoff;
  },
  
  /**
   * Day of week (0 = Sunday, 1 = Monday, etc.)
   */
  day_of_week: (fieldValue, conditionValue) => {
    const now = new Date();
    const currentDay = now.getDay();
    
    if (Array.isArray(conditionValue)) {
      return conditionValue.includes(currentDay);
    }
    return currentDay === parseInt(conditionValue);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CONDITION EVALUATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evaluate a single condition
 */
function evaluateCondition(condition, context) {
  const { field, operator, value } = condition;
  
  // Get field value from context
  const fieldValue = getNestedValue(context, field);
  
  // Get operator function
  const operatorFn = operators[operator];
  if (!operatorFn) {
    logger.warn(`[ConditionEval] Unknown operator: ${operator}`);
    return false;
  }
  
  // Evaluate
  const result = operatorFn(fieldValue, value);
  
  logger.debug(`[ConditionEval] ${field} ${operator} ${value} = ${result}`, {
    fieldValue,
    conditionValue: value
  });
  
  return result;
}

/**
 * Evaluate all conditions with AND/OR logic
 */
function evaluateConditions(conditions, context) {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions = always match
  }
  
  // Group conditions by logical operator
  // Default is AND between all conditions
  let currentResult = null;
  let currentOperator = 'AND';
  
  for (const condition of conditions) {
    const result = evaluateCondition(condition, context);
    
    if (currentResult === null) {
      currentResult = result;
    } else {
      if (currentOperator === 'AND') {
        currentResult = currentResult && result;
      } else {
        currentResult = currentResult || result;
      }
    }
    
    // Get operator for next condition
    currentOperator = condition.logicalOperator || 'AND';
    
    // Short-circuit for AND
    if (!currentResult && currentOperator === 'AND') {
      return false;
    }
  }
  
  return currentResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER FILTER EVALUATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evaluate trigger filters (quick pre-filtering before conditions)
 */
function evaluateTriggerFilters(filters, context) {
  if (!filters) return { matched: true };
  
  // Channel filter
  if (filters.channel && filters.channel !== 'all') {
    if (context.channel && context.channel !== filters.channel) {
      return { matched: false, reason: `Channel mismatch: expected ${filters.channel}` };
    }
  }
  
  // Message type filter
  if (filters.messageTypes && filters.messageTypes.length > 0) {
    if (context.message?.type && !filters.messageTypes.includes(context.message.type)) {
      return { matched: false, reason: `Message type mismatch` };
    }
  }
  
  // Keyword filter (any match)
  if (filters.keywords && filters.keywords.length > 0) {
    const messageContent = context.message?.content || context.message?.text || '';
    const hasKeyword = filters.keywords.some(keyword => 
      messageContent.toLowerCase().includes(keyword.toLowerCase())
    );
    if (!hasKeyword) {
      return { matched: false, reason: 'No keyword match' };
    }
  }
  
  // Required tags filter
  if (filters.requiredTags && filters.requiredTags.length > 0) {
    const contactTags = context.contact?.tags || [];
    const hasAllTags = filters.requiredTags.every(tag =>
      contactTags.some(ct => ct.toLowerCase() === tag.toLowerCase())
    );
    if (!hasAllTags) {
      return { matched: false, reason: 'Missing required tags' };
    }
  }
  
  // Exclude tags filter
  if (filters.excludeTags && filters.excludeTags.length > 0) {
    const contactTags = context.contact?.tags || [];
    const hasExcludedTag = filters.excludeTags.some(tag =>
      contactTags.some(ct => ct.toLowerCase() === tag.toLowerCase())
    );
    if (hasExcludedTag) {
      return { matched: false, reason: 'Has excluded tag' };
    }
  }
  
  // Source filter
  if (filters.source && filters.source !== 'all') {
    if (context.source && context.source !== filters.source) {
      return { matched: false, reason: `Source mismatch: expected ${filters.source}` };
    }
  }
  
  return { matched: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY CONDITION EVALUATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evaluate legacy condition object (backwards compatibility)
 */
function evaluateLegacyCondition(condition, context) {
  if (!condition || Object.keys(condition).length === 0) {
    return true;
  }
  
  const { type, keywords, tags, adIds, messageTypes } = condition;
  
  // Keyword condition
  if (type === 'keyword' && keywords && keywords.length > 0) {
    const messageContent = context.message?.content || context.message?.text || '';
    return keywords.some(kw => 
      messageContent.toLowerCase().includes(kw.toLowerCase())
    );
  }
  
  // Tag condition
  if (type === 'tag' && tags && tags.length > 0) {
    const contactTags = context.contact?.tags || [];
    return tags.some(tag =>
      contactTags.some(ct => ct.toLowerCase() === tag.toLowerCase())
    );
  }
  
  // Ad source condition
  if (type === 'ad_source' && adIds && adIds.length > 0) {
    return adIds.includes(context.adId) || adIds.includes(context.metadata?.adId);
  }
  
  // Message type condition
  if (type === 'message_type' && messageTypes && messageTypes.length > 0) {
    return messageTypes.includes(context.message?.type);
  }
  
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EVALUATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evaluate if a rule matches the given context
 */
function evaluateRule(rule, context) {
  // 1. Check trigger filters (quick rejection)
  const filterResult = evaluateTriggerFilters(rule.trigger?.filters, context);
  if (!filterResult.matched) {
    return { 
      matched: false, 
      reason: 'FILTER_NOT_MATCHED',
      details: filterResult.reason
    };
  }
  
  // 2. Evaluate structured conditions (Stage 6)
  if (rule.conditions && rule.conditions.length > 0) {
    const conditionsMatch = evaluateConditions(rule.conditions, context);
    if (!conditionsMatch) {
      return { 
        matched: false, 
        reason: 'CONDITION_NOT_MET',
        details: 'Structured conditions not satisfied'
      };
    }
  }
  
  // 3. Evaluate legacy condition (backwards compatibility)
  if (rule.condition && Object.keys(rule.condition).length > 0) {
    const legacyMatch = evaluateLegacyCondition(rule.condition, context);
    if (!legacyMatch) {
      return { 
        matched: false, 
        reason: 'CONDITION_NOT_MET',
        details: 'Legacy condition not satisfied'
      };
    }
  }
  
  return { matched: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  evaluateCondition,
  evaluateConditions,
  evaluateTriggerFilters,
  evaluateLegacyCondition,
  evaluateRule,
  getNestedValue,
  operators
};
