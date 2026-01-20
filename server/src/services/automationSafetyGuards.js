/**
 * Automation Safety Guards - Stage 6 Automation Engine
 * 
 * Implements safety mechanisms to prevent:
 * - Rate limit abuse
 * - Infinite loops
 * - Contact spam
 * - System overload
 */

const AutomationRule = require('../models/AutomationRule');
const AutomationExecution = require('../models/AutomationExecution');
const Workspace = require('../models/Workspace');
const { logger } = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const SAFETY_CONFIG = {
  // Global limits
  globalMaxExecutionsPerMinute: 1000,
  globalMaxExecutionsPerHour: 50000,
  
  // Per-workspace defaults
  workspaceMaxRulesPerMinute: 100,
  workspaceMaxRulesPerHour: 5000,
  
  // Loop detection
  loopDetectionWindowMs: 10000, // 10 seconds
  loopDetectionThreshold: 3,    // 3 executions in window = loop
  
  // Cooldown defaults
  defaultContactCooldownMs: 300000,      // 5 minutes
  defaultConversationCooldownMs: 60000,  // 1 minute
  
  // Business hours (can be overridden per workspace)
  defaultBusinessHours: {
    start: 9,  // 9 AM
    end: 18,   // 6 PM
    timezone: 'UTC',
    days: [1, 2, 3, 4, 5] // Monday to Friday
  }
};

// In-memory counters for rate limiting
const globalCounters = {
  minute: { count: 0, resetAt: Date.now() + 60000 },
  hour: { count: 0, resetAt: Date.now() + 3600000 }
};

const workspaceCounters = new Map();

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL KILL SWITCH
// ═══════════════════════════════════════════════════════════════════════════

let globalKillSwitch = false;

/**
 * Enable global automation
 */
function enableGlobalAutomation() {
  globalKillSwitch = false;
  logger.info('[SafetyGuards] Global automation enabled');
}

/**
 * Disable global automation (kill switch)
 */
function disableGlobalAutomation() {
  globalKillSwitch = true;
  logger.warn('[SafetyGuards] GLOBAL AUTOMATION KILL SWITCH ACTIVATED');
}

/**
 * Check if global automation is enabled
 */
function isGlobalAutomationEnabled() {
  return !globalKillSwitch;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKSPACE AUTOMATION CONTROL
// ═══════════════════════════════════════════════════════════════════════════

// Cache for workspace automation settings
const workspaceAutomationCache = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Check if workspace has automation enabled
 */
async function isWorkspaceAutomationEnabled(workspaceId) {
  const cached = workspaceAutomationCache.get(workspaceId.toString());
  if (cached && Date.now() < cached.expiry) {
    return cached.enabled;
  }
  
  try {
    const workspace = await Workspace.findById(workspaceId).select('settings.automationEnabled').lean();
    const enabled = workspace?.settings?.automationEnabled !== false; // Default true
    
    workspaceAutomationCache.set(workspaceId.toString(), {
      enabled,
      expiry: Date.now() + CACHE_TTL
    });
    
    return enabled;
  } catch (error) {
    logger.error('[SafetyGuards] Error checking workspace automation:', error);
    return true; // Fail open for existing automations
  }
}

/**
 * Clear workspace cache (call when settings change)
 */
function clearWorkspaceCache(workspaceId) {
  workspaceAutomationCache.delete(workspaceId.toString());
}

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reset counters if window expired
 */
function resetCountersIfNeeded() {
  const now = Date.now();
  
  // Global counters
  if (now >= globalCounters.minute.resetAt) {
    globalCounters.minute = { count: 0, resetAt: now + 60000 };
  }
  if (now >= globalCounters.hour.resetAt) {
    globalCounters.hour = { count: 0, resetAt: now + 3600000 };
  }
  
  // Workspace counters (lazy cleanup)
  for (const [wsId, counters] of workspaceCounters) {
    if (now >= counters.minute.resetAt && now >= counters.hour.resetAt) {
      workspaceCounters.delete(wsId);
    }
  }
}

/**
 * Get or create workspace counters
 */
function getWorkspaceCounters(workspaceId) {
  const wsKey = workspaceId.toString();
  const now = Date.now();
  
  if (!workspaceCounters.has(wsKey)) {
    workspaceCounters.set(wsKey, {
      minute: { count: 0, resetAt: now + 60000 },
      hour: { count: 0, resetAt: now + 3600000 }
    });
  }
  
  const counters = workspaceCounters.get(wsKey);
  
  // Reset if expired
  if (now >= counters.minute.resetAt) {
    counters.minute = { count: 0, resetAt: now + 60000 };
  }
  if (now >= counters.hour.resetAt) {
    counters.hour = { count: 0, resetAt: now + 3600000 };
  }
  
  return counters;
}

/**
 * Check global rate limits
 */
function checkGlobalRateLimit() {
  resetCountersIfNeeded();
  
  if (globalCounters.minute.count >= SAFETY_CONFIG.globalMaxExecutionsPerMinute) {
    return { allowed: false, reason: 'Global per-minute limit exceeded' };
  }
  
  if (globalCounters.hour.count >= SAFETY_CONFIG.globalMaxExecutionsPerHour) {
    return { allowed: false, reason: 'Global per-hour limit exceeded' };
  }
  
  return { allowed: true };
}

/**
 * Check workspace rate limits
 */
function checkWorkspaceRateLimit(workspaceId) {
  const counters = getWorkspaceCounters(workspaceId);
  
  if (counters.minute.count >= SAFETY_CONFIG.workspaceMaxRulesPerMinute) {
    return { allowed: false, reason: 'Workspace per-minute limit exceeded' };
  }
  
  if (counters.hour.count >= SAFETY_CONFIG.workspaceMaxRulesPerHour) {
    return { allowed: false, reason: 'Workspace per-hour limit exceeded' };
  }
  
  return { allowed: true };
}

/**
 * Check rule-specific rate limit
 */
async function checkRuleRateLimit(rule) {
  // Check and reset window if needed
  const updatedRule = await AutomationRule.checkAndResetWindow(rule._id);
  if (!updatedRule) {
    return { allowed: false, reason: 'Rule not found' };
  }
  
  if (!updatedRule.isWithinRateLimit()) {
    return { allowed: false, reason: 'Rule rate limit exceeded' };
  }
  
  // Check daily limit
  const ruleWithDailyReset = await AutomationRule.resetDailyCountsIfNeeded(rule._id);
  if (!ruleWithDailyReset.isWithinDailyLimit()) {
    return { allowed: false, reason: 'Rule daily limit exceeded' };
  }
  
  return { allowed: true, rule: ruleWithDailyReset };
}

/**
 * Increment rate limit counters after execution
 */
function incrementCounters(workspaceId) {
  globalCounters.minute.count++;
  globalCounters.hour.count++;
  
  const counters = getWorkspaceCounters(workspaceId);
  counters.minute.count++;
  counters.hour.count++;
}

// ═══════════════════════════════════════════════════════════════════════════
// COOLDOWN CHECKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if contact is in cooldown
 */
async function checkContactCooldown(rule, contactId) {
  const cooldownMs = (rule.rateLimit?.perContactCooldown || 300) * 1000;
  
  const inCooldown = await AutomationExecution.isContactInCooldown(
    rule._id,
    contactId,
    cooldownMs / 1000
  );
  
  if (inCooldown) {
    return { allowed: false, reason: 'Contact in cooldown period' };
  }
  
  return { allowed: true };
}

/**
 * Check if conversation is in cooldown
 */
async function checkConversationCooldown(rule, conversationId) {
  if (!conversationId) return { allowed: true };
  
  const cooldownMs = (rule.rateLimit?.perConversationCooldown || 60) * 1000;
  
  const inCooldown = await AutomationExecution.isConversationInCooldown(
    rule._id,
    conversationId,
    cooldownMs / 1000
  );
  
  if (inCooldown) {
    return { allowed: false, reason: 'Conversation in cooldown period' };
  }
  
  return { allowed: true };
}

/**
 * Check per-contact daily limit
 */
async function checkContactDailyLimit(rule, contactId) {
  const maxPerDay = rule.rateLimit?.maxPerContactPerDay || 10;
  const count = await AutomationExecution.getContactDailyCount(rule._id, contactId);
  
  if (count >= maxPerDay) {
    return { allowed: false, reason: 'Contact daily limit exceeded' };
  }
  
  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// LOOP DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect potential automation loop
 */
async function detectLoop(rule, conversationId) {
  if (!conversationId) return { loopDetected: false };
  
  const isLoop = await AutomationExecution.detectLoop(
    rule._id,
    conversationId,
    SAFETY_CONFIG.loopDetectionWindowMs / 1000
  );
  
  if (isLoop) {
    logger.warn(`[SafetyGuards] Loop detected for rule ${rule._id} on conversation ${conversationId}`);
    return { loopDetected: true, reason: 'Automation loop detected' };
  }
  
  return { loopDetected: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS HOURS CHECK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if current time is within business hours
 */
function isWithinBusinessHours(workspaceSettings = {}) {
  const businessHours = workspaceSettings.businessHours || SAFETY_CONFIG.defaultBusinessHours;
  
  const now = new Date();
  const hour = now.getUTCHours();
  const day = now.getUTCDay();
  
  // Check day
  if (!businessHours.days.includes(day)) {
    return false;
  }
  
  // Check hours
  if (hour < businessHours.start || hour >= businessHours.end) {
    return false;
  }
  
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE SAFETY CHECK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run all safety checks for a rule execution
 */
async function runSafetyChecks(rule, context) {
  const { workspaceId, contactId, conversationId } = context;
  
  // 1. Global kill switch
  if (!isGlobalAutomationEnabled()) {
    return { 
      allowed: false, 
      skipReason: 'GLOBAL_KILL_SWITCH',
      skipDetails: 'Global automation is disabled'
    };
  }
  
  // 2. Workspace automation enabled
  const wsEnabled = await isWorkspaceAutomationEnabled(workspaceId);
  if (!wsEnabled) {
    return { 
      allowed: false, 
      skipReason: 'WORKSPACE_DISABLED',
      skipDetails: 'Workspace automation is disabled'
    };
  }
  
  // 3. Rule enabled
  if (!rule.enabled) {
    return { 
      allowed: false, 
      skipReason: 'RULE_DISABLED',
      skipDetails: 'Rule is disabled'
    };
  }
  
  // 4. Global rate limit
  const globalCheck = checkGlobalRateLimit();
  if (!globalCheck.allowed) {
    return { 
      allowed: false, 
      skipReason: 'RATE_LIMIT_EXCEEDED',
      skipDetails: globalCheck.reason
    };
  }
  
  // 5. Workspace rate limit
  const workspaceCheck = checkWorkspaceRateLimit(workspaceId);
  if (!workspaceCheck.allowed) {
    return { 
      allowed: false, 
      skipReason: 'RATE_LIMIT_EXCEEDED',
      skipDetails: workspaceCheck.reason
    };
  }
  
  // 6. Rule rate limit
  const ruleCheck = await checkRuleRateLimit(rule);
  if (!ruleCheck.allowed) {
    return { 
      allowed: false, 
      skipReason: 'RATE_LIMIT_EXCEEDED',
      skipDetails: ruleCheck.reason
    };
  }
  
  // 7. Contact cooldown
  if (contactId) {
    const contactCheck = await checkContactCooldown(rule, contactId);
    if (!contactCheck.allowed) {
      return { 
        allowed: false, 
        skipReason: 'CONTACT_COOLDOWN',
        skipDetails: contactCheck.reason
      };
    }
    
    // 8. Contact daily limit
    const dailyCheck = await checkContactDailyLimit(rule, contactId);
    if (!dailyCheck.allowed) {
      return { 
        allowed: false, 
        skipReason: 'DAILY_LIMIT_EXCEEDED',
        skipDetails: dailyCheck.reason
      };
    }
  }
  
  // 9. Conversation cooldown
  if (conversationId) {
    const convCheck = await checkConversationCooldown(rule, conversationId);
    if (!convCheck.allowed) {
      return { 
        allowed: false, 
        skipReason: 'CONVERSATION_COOLDOWN',
        skipDetails: convCheck.reason
      };
    }
  }
  
  // 10. Loop detection
  const loopCheck = await detectLoop(rule, conversationId);
  if (loopCheck.loopDetected) {
    return { 
      allowed: false, 
      skipReason: 'LOOP_DETECTED',
      skipDetails: loopCheck.reason
    };
  }
  
  // 11. Business hours (if required by trigger)
  if (rule.trigger?.filters?.businessHoursOnly) {
    if (!isWithinBusinessHours()) {
      return { 
        allowed: false, 
        skipReason: 'OUTSIDE_BUSINESS_HOURS',
        skipDetails: 'Outside configured business hours'
      };
    }
  }
  
  // All checks passed
  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get current safety status
 */
function getSafetyStatus() {
  resetCountersIfNeeded();
  
  return {
    globalKillSwitch,
    globalCounters: {
      minute: {
        count: globalCounters.minute.count,
        limit: SAFETY_CONFIG.globalMaxExecutionsPerMinute,
        resetIn: Math.max(0, globalCounters.minute.resetAt - Date.now())
      },
      hour: {
        count: globalCounters.hour.count,
        limit: SAFETY_CONFIG.globalMaxExecutionsPerHour,
        resetIn: Math.max(0, globalCounters.hour.resetAt - Date.now())
      }
    },
    activeWorkspaces: workspaceCounters.size,
    config: SAFETY_CONFIG
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // Kill switch
  enableGlobalAutomation,
  disableGlobalAutomation,
  isGlobalAutomationEnabled,
  
  // Workspace control
  isWorkspaceAutomationEnabled,
  clearWorkspaceCache,
  
  // Rate limiting
  checkGlobalRateLimit,
  checkWorkspaceRateLimit,
  checkRuleRateLimit,
  incrementCounters,
  
  // Cooldowns
  checkContactCooldown,
  checkConversationCooldown,
  checkContactDailyLimit,
  
  // Loop detection
  detectLoop,
  
  // Business hours
  isWithinBusinessHours,
  
  // Main safety check
  runSafetyChecks,
  
  // Monitoring
  getSafetyStatus,
  
  // Config
  SAFETY_CONFIG
};
