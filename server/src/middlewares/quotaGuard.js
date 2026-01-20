/**
 * Quota Guard Middleware - Stage 5
 * 
 * Enforces conversation quota limits before sending:
 * - Campaign messages
 * - Inbox template messages
 * - API messages
 * 
 * Behavior:
 * - Soft warning at 80% usage (returns warning in response, allows send)
 * - Hard block at 100% usage (blocks send, returns error)
 * - Per-category limits (optional, for enterprise)
 * 
 * Error Codes:
 * - QUOTA_WARNING: At 80% threshold, message sent with warning
 * - QUOTA_EXCEEDED: At 100% threshold, message blocked
 * - CATEGORY_QUOTA_EXCEEDED: Specific category limit reached
 */

const Workspace = require('../models/Workspace');
const { logger } = require('../utils/logger');

/**
 * Check quota before sending messages
 * Used as middleware or called directly from services
 * 
 * @param {ObjectId} workspaceId 
 * @param {String} category - MARKETING, UTILITY, AUTHENTICATION, SERVICE
 * @param {Number} messageCount - Number of messages to send (for campaigns)
 * @returns {Object} { allowed, warning, error, quotaStatus }
 */
async function checkQuota(workspaceId, category = 'UTILITY', messageCount = 1) {
  try {
    const workspace = await Workspace.findById(workspaceId)
      .select('billingQuota billingUsage plan')
      .lean();
    
    if (!workspace) {
      return {
        allowed: false,
        error: {
          code: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace not found'
        }
      };
    }
    
    const quota = workspace.billingQuota || {};
    const usage = workspace.billingUsage || {};
    
    // Get limits
    const totalLimit = quota.monthlyConversations || 1000;
    const warningThreshold = quota.warningThreshold || 80;
    const blockThreshold = quota.blockThreshold || 100;
    const hardBlock = quota.hardBlock !== false;
    
    // Get current usage
    const totalUsed = usage.monthlyConversationsUsed || 0;
    const projectedUsage = totalUsed + messageCount;
    
    // Calculate percentages
    const currentPercentage = (totalUsed / totalLimit) * 100;
    const projectedPercentage = (projectedUsage / totalLimit) * 100;
    
    // Build quota status response
    const quotaStatus = {
      used: totalUsed,
      limit: totalLimit,
      remaining: Math.max(0, totalLimit - totalUsed),
      percentage: Math.round(currentPercentage * 100) / 100,
      projectedUsage,
      projectedPercentage: Math.round(projectedPercentage * 100) / 100,
      category
    };
    
    // Check category-specific limits if set
    const categoryLimitField = `${category.toLowerCase()}Conversations`;
    const categoryUsedField = `${category.toLowerCase()}Used`;
    
    if (quota[categoryLimitField]) {
      const categoryLimit = quota[categoryLimitField];
      const categoryUsed = usage[categoryUsedField] || 0;
      const categoryPercentage = (categoryUsed / categoryLimit) * 100;
      
      quotaStatus.categoryUsed = categoryUsed;
      quotaStatus.categoryLimit = categoryLimit;
      quotaStatus.categoryPercentage = Math.round(categoryPercentage * 100) / 100;
      
      // Check category limit
      if (categoryUsed + messageCount > categoryLimit) {
        logger.warn('[QuotaGuard] Category quota exceeded', {
          workspaceId,
          category,
          used: categoryUsed,
          limit: categoryLimit
        });
        
        return {
          allowed: false,
          error: {
            code: 'CATEGORY_QUOTA_EXCEEDED',
            message: `Monthly ${category} conversation limit reached (${categoryUsed}/${categoryLimit})`,
            category,
            used: categoryUsed,
            limit: categoryLimit
          },
          quotaStatus
        };
      }
    }
    
    // Check total limit - BLOCK
    if (projectedPercentage >= blockThreshold) {
      if (hardBlock) {
        logger.warn('[QuotaGuard] Quota exceeded - blocked', {
          workspaceId,
          used: totalUsed,
          limit: totalLimit,
          percentage: currentPercentage
        });
        
        return {
          allowed: false,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: `Monthly conversation limit reached (${totalUsed}/${totalLimit}). Please upgrade your plan or wait for the next billing period.`,
            used: totalUsed,
            limit: totalLimit,
            percentage: currentPercentage
          },
          quotaStatus
        };
      }
      
      // Soft block - allow but warn
      return {
        allowed: true,
        warning: {
          code: 'QUOTA_SOFT_EXCEEDED',
          message: `You have exceeded your monthly quota (${Math.round(currentPercentage)}%). Messages may be charged at overage rates.`,
          used: totalUsed,
          limit: totalLimit,
          percentage: currentPercentage
        },
        quotaStatus
      };
    }
    
    // Check warning threshold
    if (currentPercentage >= warningThreshold) {
      logger.info('[QuotaGuard] Quota warning', {
        workspaceId,
        used: totalUsed,
        limit: totalLimit,
        percentage: currentPercentage
      });
      
      return {
        allowed: true,
        warning: {
          code: 'QUOTA_WARNING',
          message: `You have used ${Math.round(currentPercentage)}% of your monthly quota (${totalUsed}/${totalLimit} conversations).`,
          used: totalUsed,
          limit: totalLimit,
          remaining: totalLimit - totalUsed,
          percentage: currentPercentage
        },
        quotaStatus
      };
    }
    
    // All good
    return {
      allowed: true,
      quotaStatus
    };
    
  } catch (error) {
    logger.error('[QuotaGuard] checkQuota failed:', error);
    
    // Fail open - allow message but log error
    return {
      allowed: true,
      error: {
        code: 'QUOTA_CHECK_FAILED',
        message: 'Could not verify quota status',
        internal: error.message
      }
    };
  }
}

/**
 * Express middleware for quota enforcement
 * Attaches quota status to req.quotaStatus
 * 
 * Usage:
 * router.post('/send', quotaGuard('UTILITY'), sendMessageController);
 * 
 * @param {String} category - Default category for quota check
 * @param {Object} options - { blockOnError: boolean }
 */
function quotaGuard(category = 'UTILITY', options = {}) {
  const { blockOnError = false } = options;
  
  return async (req, res, next) => {
    try {
      const workspaceId = req.user?.workspace || req.body?.workspaceId;
      
      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          error: 'Workspace ID required',
          code: 'MISSING_WORKSPACE'
        });
      }
      
      // Determine category from request if available
      const requestCategory = req.body?.category || 
                              req.body?.templateCategory ||
                              category;
      
      // Determine message count (for campaigns)
      const messageCount = req.body?.contacts?.length || 
                           req.body?.messageCount || 
                           1;
      
      const quotaCheck = await checkQuota(workspaceId, requestCategory, messageCount);
      
      // Attach to request for downstream use
      req.quotaStatus = quotaCheck.quotaStatus;
      req.quotaWarning = quotaCheck.warning;
      
      if (!quotaCheck.allowed) {
        logger.warn('[QuotaGuard] Request blocked by quota', {
          workspaceId,
          category: requestCategory,
          error: quotaCheck.error?.code
        });
        
        return res.status(402).json({
          success: false,
          error: quotaCheck.error.message,
          code: quotaCheck.error.code,
          quota: quotaCheck.quotaStatus
        });
      }
      
      // Continue with warning in response
      if (quotaCheck.warning) {
        // Set response header for warning
        res.set('X-Quota-Warning', quotaCheck.warning.code);
        res.set('X-Quota-Usage', `${quotaCheck.quotaStatus.used}/${quotaCheck.quotaStatus.limit}`);
      }
      
      next();
      
    } catch (error) {
      logger.error('[QuotaGuard] Middleware error:', error);
      
      if (blockOnError) {
        return res.status(500).json({
          success: false,
          error: 'Quota check failed',
          code: 'QUOTA_CHECK_ERROR'
        });
      }
      
      // Fail open
      next();
    }
  };
}

/**
 * Check campaign quota before starting
 * Returns detailed quota info for campaign UI
 * 
 * @param {ObjectId} workspaceId 
 * @param {String} templateCategory 
 * @param {Number} contactCount 
 */
async function checkCampaignQuota(workspaceId, templateCategory, contactCount) {
  const quotaCheck = await checkQuota(workspaceId, templateCategory, contactCount);
  
  if (!quotaCheck.allowed) {
    return {
      canStart: false,
      reason: quotaCheck.error.code,
      message: quotaCheck.error.message,
      quota: quotaCheck.quotaStatus,
      suggestedAction: quotaCheck.error.code === 'QUOTA_EXCEEDED' 
        ? 'UPGRADE_PLAN' 
        : 'REDUCE_CONTACTS'
    };
  }
  
  // Calculate how many contacts can be sent to
  const remaining = quotaCheck.quotaStatus.remaining;
  const canSendAll = remaining >= contactCount;
  
  return {
    canStart: true,
    canSendAll,
    contactCount,
    quotaRemaining: remaining,
    warning: quotaCheck.warning,
    quota: quotaCheck.quotaStatus,
    suggestedAction: canSendAll ? null : 'REDUCE_CONTACTS',
    maxContactsAllowed: remaining
  };
}

/**
 * Get quota status for UI display
 * 
 * @param {ObjectId} workspaceId 
 */
async function getQuotaStatusForUI(workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId)
      .select('billingQuota billingUsage plan name')
      .lean();
    
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    
    const quota = workspace.billingQuota || {};
    const usage = workspace.billingUsage || {};
    
    const totalLimit = quota.monthlyConversations || 1000;
    const totalUsed = usage.monthlyConversationsUsed || 0;
    const percentage = (totalUsed / totalLimit) * 100;
    
    // Calculate days remaining in billing period
    const now = new Date();
    const periodEnd = usage.billingPeriodEnd || 
                      new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysRemaining = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
    
    // Calculate average daily usage
    const periodStart = usage.billingPeriodStart || 
                        new Date(now.getFullYear(), now.getMonth(), 1);
    const daysElapsed = Math.max(1, Math.ceil((now - periodStart) / (1000 * 60 * 60 * 24)));
    const dailyAverage = Math.round(totalUsed / daysElapsed);
    
    // Project end-of-month usage
    const projectedUsage = totalUsed + (dailyAverage * daysRemaining);
    const projectedPercentage = (projectedUsage / totalLimit) * 100;
    
    return {
      plan: workspace.plan,
      workspace: workspace.name,
      
      // Current usage
      used: totalUsed,
      limit: totalLimit,
      remaining: Math.max(0, totalLimit - totalUsed),
      percentage: Math.round(percentage * 100) / 100,
      
      // Status flags
      isWarning: percentage >= (quota.warningThreshold || 80),
      isBlocked: percentage >= (quota.blockThreshold || 100),
      warningThreshold: quota.warningThreshold || 80,
      blockThreshold: quota.blockThreshold || 100,
      
      // Category breakdown
      byCategory: {
        marketing: usage.marketingUsed || 0,
        utility: usage.utilityUsed || 0,
        authentication: usage.authenticationUsed || 0,
        service: usage.serviceUsed || 0
      },
      
      // Source breakdown
      bySource: {
        campaigns: usage.campaignConversations || 0,
        inbox: usage.inboxConversations || 0,
        api: usage.apiConversations || 0,
        automation: usage.automationConversations || 0
      },
      
      // Initiator breakdown
      byInitiator: {
        business: usage.businessInitiated || 0,
        user: usage.userInitiated || 0
      },
      
      // Message stats
      messages: {
        sent: usage.totalMessagesSent || 0,
        received: usage.totalMessagesReceived || 0,
        templates: usage.templateMessagesSent || 0
      },
      
      // Billing period
      billingPeriod: {
        start: periodStart,
        end: periodEnd,
        daysRemaining,
        daysElapsed
      },
      
      // Projections
      projections: {
        dailyAverage,
        projectedUsage: Math.round(projectedUsage),
        projectedPercentage: Math.round(projectedPercentage * 100) / 100,
        willExceed: projectedUsage > totalLimit
      },
      
      // Last reset
      lastResetAt: usage.lastResetAt
    };
    
  } catch (error) {
    logger.error('[QuotaGuard] getQuotaStatusForUI failed:', error);
    throw error;
  }
}

module.exports = {
  checkQuota,
  quotaGuard,
  checkCampaignQuota,
  getQuotaStatusForUI
};
