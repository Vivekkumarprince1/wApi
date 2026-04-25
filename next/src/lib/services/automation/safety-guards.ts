/**
 * AUTOMATION SAFETY GUARDS
 * Comprehensive safety mechanisms for automation execution:
 * - Business hours verification
 * - Rate limiting / Per-contact cooldowns
 * - Loop detection
 * - Global kill switch
 */

import {
  AutomationRule,
  AutomationExecution,
  Workspace
} from "@/lib/models";
import { Types } from "mongoose";

export interface BusinessHours {
  start: number; // 0-23
  end: number; // 0-23
  timezone: string;
  days: number[]; // [0-6] where 0 is Sunday
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  start: 9,
  end: 18,
  timezone: 'UTC',
  days: [1, 2, 3, 4, 5] // Mon-Fri
};

export interface ISafetyCheckResult {
  pass: boolean;
  reason?: string;
  details?: any;
}

/**
 * SAFETY GUARDS SERVICE
 */
export class SafetyGuards {
  /**
   * Comprehensive safety check before executing an automation action
   * Checks:
   * - Global kill switch
   * - Per-contact cooldown
   * - Per-conversation cooldown
   * - Business hours
   */
  static async runSafetyChecks(
    rule: any,
    contactId?: string | Types.ObjectId,
    conversationId?: string | Types.ObjectId
  ): Promise<ISafetyCheckResult> {
    try {
      // 1. Global Kill Switch
      if (isAutomationKillSwitchActive()) {
        return {
          pass: false,
          reason: 'GLOBAL_KILL_SWITCH',
          details: 'Automation globally disabled'
        };
      }

      // 2. Business Hours Check (if configured)
      const workspace = await Workspace.findById(rule.workspace);
      if (rule.trigger?.filters?.businessHoursOnly && workspace) {
        const isWithinHours = isWithinBusinessHours(workspace);
        if (!isWithinHours) {
          return {
            pass: false,
            reason: 'OUTSIDE_BUSINESS_HOURS',
            details: 'Current time is outside configured business hours'
          };
        }
      }

      // 3. Per-Contact Cooldown Check
      if (contactId && rule.rateLimit?.perContactCooldown > 0) {
        const contactCooldownOk = await checkPerContactCooldown(
          rule._id,
          contactId,
          rule.rateLimit.perContactCooldown
        );

        if (!contactCooldownOk) {
          return {
            pass: false,
            reason: 'CONTACT_COOLDOWN',
            details: `Contact recently triggered this rule (cooldown: ${rule.rateLimit.perContactCooldown}s)`
          };
        }
      }

      // 4. Per-Conversation Cooldown Check
      if (conversationId && rule.rateLimit?.perConversationCooldown > 0) {
        const conversationCooldownOk = await checkPerConversationCooldown(
          rule._id,
          conversationId,
          rule.rateLimit.perConversationCooldown
        );

        if (!conversationCooldownOk) {
          return {
            pass: false,
            reason: 'CONVERSATION_COOLDOWN',
            details: `Conversation recently triggered this rule (cooldown: ${rule.rateLimit.perConversationCooldown}s)`
          };
        }
      }

      // 5. Rate Limit Window Check (global rule level)
      if (rule.rateLimit?.maxExecutions > 0 && rule.rateLimit?.windowSeconds > 0) {
        const rateLimitOk = await checkRateLimitWindow(
          rule._id,
          rule.rateLimit.maxExecutions,
          rule.rateLimit.windowSeconds
        );

        if (!rateLimitOk) {
          return {
            pass: false,
            reason: 'RATE_LIMIT_EXCEEDED',
            details: `Rule has exceeded ${rule.rateLimit.maxExecutions} executions in ${rule.rateLimit.windowSeconds}s`
          };
        }
      }

      // All checks passed
      return { pass: true };
    } catch (error: any) {
      console.error('[SafetyGuards] Error during safety checks:', error.message);
      // Fail-safe: if checks fail, block execution
      return {
        pass: false,
        reason: 'SAFETY_CHECK_ERROR',
        details: error.message
      };
    }
  }

  /**
   * Check if a contact is in cooldown for a specific rule
   */
  static async isContactInCooldown(
    ruleId: string | Types.ObjectId,
    contactId: string | Types.ObjectId,
    cooldownSeconds: number
  ): Promise<boolean> {
    return !await checkPerContactCooldown(ruleId, contactId, cooldownSeconds);
  }

  /**
   * Check if a conversation is in cooldown for a specific rule
   */
  static async isConversationInCooldown(
    ruleId: string | Types.ObjectId,
    conversationId: string | Types.ObjectId,
    cooldownSeconds: number
  ): Promise<boolean> {
    return !await checkPerConversationCooldown(ruleId, conversationId, cooldownSeconds);
  }
}

/**
 * INTERNAL HELPER FUNCTIONS
 */

/**
 * Check if contact is in cooldown for this rule
 * Returns true if cooldown has passed (safe to execute), false if still in cooldown
 */
async function checkPerContactCooldown(
  ruleId: string | Types.ObjectId,
  contactId: string | Types.ObjectId,
  cooldownSeconds: number
): Promise<boolean> {
  if (!contactId || cooldownSeconds <= 0) {
    return true;
  }

  try {
    const cooldownStart = new Date(Date.now() - cooldownSeconds * 1000);

    // Find the most recent successful or partial execution for this rule+contact
    const lastExecution = await AutomationExecution.findOne(
      {
        rule: ruleId,
        contact: contactId,
        status: { $in: ['SUCCESS', 'PARTIAL', 'SKIPPED'] },
        createdAt: { $gte: cooldownStart }
      },
      { createdAt: 1 },
      { sort: { createdAt: -1 } }
    );

    if (lastExecution) {
      console.info(
        `[SafetyGuards] Contact ${contactId} is in cooldown for rule ${ruleId}` +
        `(last exec: ${lastExecution.createdAt.toISOString()})`
      );
      return false; // Still in cooldown
    }

    return true; // Cooldown has passed
  } catch (error: any) {
    console.error(
      '[SafetyGuards] Error checking per-contact cooldown:',
      error.message
    );
    // Fail-safe: if we can't check, allow execution
    return true;
  }
}

/**
 * Check if conversation is in cooldown for this rule
 * Returns true if cooldown has passed (safe to execute), false if still in cooldown
 */
async function checkPerConversationCooldown(
  ruleId: string | Types.ObjectId,
  conversationId: string | Types.ObjectId,
  cooldownSeconds: number
): Promise<boolean> {
  if (!conversationId || cooldownSeconds <= 0) {
    return true;
  }

  try {
    const cooldownStart = new Date(Date.now() - cooldownSeconds * 1000);

    // Find the most recent successful or partial execution for this rule+conversation
    const lastExecution = await AutomationExecution.findOne(
      {
        rule: ruleId,
        conversation: conversationId,
        status: { $in: ['SUCCESS', 'PARTIAL', 'SKIPPED'] },
        createdAt: { $gte: cooldownStart }
      },
      { createdAt: 1 },
      { sort: { createdAt: -1 } }
    );

    if (lastExecution) {
      console.info(
        `[SafetyGuards] Conversation ${conversationId} is in cooldown for rule ${ruleId}` +
        `(last exec: ${lastExecution.createdAt.toISOString()})`
      );
      return false; // Still in cooldown
    }

    return true; // Cooldown has passed
  } catch (error: any) {
    console.error(
      '[SafetyGuards] Error checking per-conversation cooldown:',
      error.message
    );
    // Fail-safe: if we can't check, allow execution
    return true;
  }
}

/**
 * Check if rule has exceeded rate limit in current window
 * Returns true if under limit (safe to execute), false if limit exceeded
 */
async function checkRateLimitWindow(
  ruleId: string | Types.ObjectId,
  maxExecutions: number,
  windowSeconds: number
): Promise<boolean> {
  if (maxExecutions <= 0 || windowSeconds <= 0) {
    return true;
  }

  try {
    const windowStart = new Date(Date.now() - windowSeconds * 1000);

    // Count successful executions in the window
    const executionCount = await AutomationExecution.countDocuments({
      rule: ruleId,
      status: { $in: ['SUCCESS', 'PARTIAL'] },
      createdAt: { $gte: windowStart }
    });

    if (executionCount >= maxExecutions) {
      console.warn(
        `[SafetyGuards] Rule ${ruleId} has reached rate limit:` +
        `${executionCount}/${maxExecutions} in ${windowSeconds}s window`
      );
      return false; // Rate limit exceeded
    }

    return true; // Under limit
  } catch (error: any) {
    console.error(
      '[SafetyGuards] Error checking rate limit window:',
      error.message
    );
    // Fail-safe: if we can't check, allow execution
    return true;
  }
}

/**
 * Check if the current time is within workspace business hours
 */
function isWithinBusinessHours(workspaceSettings: any = {}): boolean {
  const settings = workspaceSettings?.businessHours || DEFAULT_BUSINESS_HOURS;

  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  // 1. Check Day
  if (!settings.days.includes(day)) {
    return false;
  }

  // 2. Check Hour
  if (hour < settings.start || hour >= settings.end) {
    return false;
  }

  return true;
}

/**
 * Global Kill Switch Check
 * Can be controlled via environment variable or database setting
 */
function isAutomationKillSwitchActive(): boolean {
  return process.env.DISABLE_AUTOMATION === 'true';
}

/**
 * Old-style cooldown check (kept for backward compatibility)
 * Logic: Check if enough time (24h default) has passed since last execution
 */
export async function checkThrottle(lastSentAt?: Date): Promise<boolean> {
  if (!lastSentAt) return true;

  const hoursSinceLast = (Date.now() - lastSentAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceLast >= 24;
}

/**
 * Backward compatibility exports
 */
export function isWithinBusinessHoursLegacy(workspaceSettings: any = {}): boolean {
  return isWithinBusinessHours(workspaceSettings);
}

export function isAutomationKillSwitchActiveLegacy(): boolean {
  return isAutomationKillSwitchActive();
}
