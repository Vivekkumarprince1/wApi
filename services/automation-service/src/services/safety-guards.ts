import {
  AutomationRule,
  AutomationExecution
} from "../models";
import { Types } from "mongoose";

/**
 * SAFETY GUARDS SERVICE (Stateless Microservice Version)
 * Comprehensive safety mechanisms: Cooldowns, Rate limits, Kill switch.
 */

export interface ISafetyCheckResult {
  pass: boolean;
  reason?: string;
  details?: any;
}

export class SafetyGuards {
  /**
   * Comprehensive safety check before executing an automation action
   */
  static async runSafetyChecks(
    rule: any,
    contactId?: string | Types.ObjectId,
    conversationId?: string | Types.ObjectId,
    context: any = {}
  ): Promise<ISafetyCheckResult> {
    try {
      // 1. Global Kill Switch
      if (process.env.DISABLE_AUTOMATION === 'true') {
        return { pass: false, reason: 'GLOBAL_KILL_SWITCH' };
      }

      // 2. Business Hours Check (Rely on context passed from monolith)
      if (rule.trigger?.filters?.businessHoursOnly && context.isOutsideBusinessHours) {
        return { pass: false, reason: 'OUTSIDE_BUSINESS_HOURS' };
      }

      // 3. Per-Contact Cooldown Check
      if (contactId && rule.rateLimit?.perContactCooldown > 0) {
        const cooldownStart = new Date(Date.now() - rule.rateLimit.perContactCooldown * 1000);
        const lastExec = await AutomationExecution.findOne({
          rule: rule._id,
          contact: contactId,
          status: { $in: ['SUCCESS', 'PARTIAL'] },
          createdAt: { $gte: cooldownStart }
        });

        if (lastExec) return { pass: false, reason: 'CONTACT_COOLDOWN' };
      }

      // 4. Rate Limit Window Check
      if (rule.rateLimit?.maxExecutions > 0 && rule.rateLimit?.windowSeconds > 0) {
        const windowStart = new Date(Date.now() - rule.rateLimit.windowSeconds * 1000);
        const count = await AutomationExecution.countDocuments({
          rule: rule._id,
          status: { $in: ['SUCCESS', 'PARTIAL'] },
          createdAt: { $gte: windowStart }
        });

        if (count >= rule.rateLimit.maxExecutions) return { pass: false, reason: 'RATE_LIMIT_EXCEEDED' };
      }

      return { pass: true };
    } catch (error: any) {
      console.error('[SafetyGuards] Error:', error.message);
      return { pass: false, reason: 'SAFETY_CHECK_ERROR' };
    }
  }

  static async checkThrottle(lastSentAt?: Date): Promise<boolean> {
    if (!lastSentAt) return true;
    const hoursSinceLast = (Date.now() - lastSentAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceLast >= 24;
  }
}
