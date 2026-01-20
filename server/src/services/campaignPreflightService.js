const Campaign = require('../models/Campaign');
const CampaignBatch = require('../models/CampaignBatch');
const Template = require('../models/Template');
const Contact = require('../models/Contact');
const Workspace = require('../models/Workspace');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN PREFLIGHT VALIDATION SERVICE - Task C
 * 
 * Comprehensive validation BEFORE campaign execution:
 * - Total recipients validation
 * - Estimated send duration calculation
 * - Workspace limits check
 * - Phone quality/tier verification
 * - Account health check
 * 
 * Blocks execution if any validation fails.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Messaging tier limits (messages per 24 hours)
const MESSAGING_TIER_LIMITS = {
  'TIER_NOT_SET': 250,
  'TIER_50': 50,
  'TIER_250': 250,
  'TIER_1K': 1000,
  'TIER_10K': 10000,
  'TIER_100K': 100000,
  'TIER_UNLIMITED': Infinity
};

// Quality ratings
const QUALITY_RATINGS = {
  GREEN: 'healthy',
  YELLOW: 'degraded',
  RED: 'critical',
  UNKNOWN: 'unknown'
};

// Rate limits for estimation (messages per minute per workspace)
const RATE_LIMITS = {
  perSecond: 50,     // Per workspace rate limit
  perMinute: 1000    // Per workspace per minute
};

// ─────────────────────────────────────────────────────────────────────────────
// PREFLIGHT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete preflight validation before campaign execution
 * @param {String} campaignId - Campaign ID
 * @returns {Object} { valid, errors, warnings, estimates }
 */
async function validateCampaignExecution(campaignId) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    estimates: {},
    checks: {}
  };
  
  try {
    // Load campaign with template
    const campaign = await Campaign.findById(campaignId)
      .populate('template');
    
    if (!campaign) {
      return {
        valid: false,
        errors: [{ code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' }],
        checks: {}
      };
    }
    
    // Load workspace
    const workspace = await Workspace.findById(campaign.workspace);
    if (!workspace) {
      return {
        valid: false,
        errors: [{ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' }],
        checks: {}
      };
    }
    
    // Run all validations
    const [
      templateCheck,
      recipientCheck,
      accountCheck,
      tierCheck,
      limitCheck,
      estimateCheck
    ] = await Promise.all([
      validateTemplate(campaign),
      validateRecipients(campaign),
      validateAccountHealth(workspace),
      validatePhoneTier(workspace, campaign),
      validateWorkspaceLimits(workspace, campaign),
      calculateEstimates(campaign, workspace)
    ]);
    
    // Aggregate results
    result.checks = {
      template: templateCheck,
      recipients: recipientCheck,
      account: accountCheck,
      tier: tierCheck,
      limits: limitCheck
    };
    
    result.estimates = estimateCheck;
    
    // Collect errors (blocking)
    for (const check of Object.values(result.checks)) {
      if (check.error) {
        result.errors.push(check.error);
      }
    }
    
    // Collect warnings (non-blocking)
    for (const check of Object.values(result.checks)) {
      if (check.warnings) {
        result.warnings.push(...check.warnings);
      }
    }
    
    result.valid = result.errors.length === 0;
    
    return result;
  } catch (error) {
    console.error('[PreflightValidation] Error:', error);
    return {
      valid: false,
      errors: [{ code: 'VALIDATION_ERROR', message: error.message }],
      checks: {}
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INDIVIDUAL CHECKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate template is still approved
 */
async function validateTemplate(campaign) {
  const result = { passed: false, warnings: [] };
  
  // Check template reference
  if (!campaign.template) {
    result.error = { code: 'TEMPLATE_REQUIRED', message: 'Campaign has no template' };
    return result;
  }
  
  // Load fresh template status
  const template = await Template.findById(campaign.template._id || campaign.template);
  
  if (!template) {
    result.error = { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found' };
    return result;
  }
  
  if (template.status !== 'APPROVED') {
    result.error = { 
      code: 'TEMPLATE_NOT_APPROVED', 
      message: `Template status is ${template.status}, must be APPROVED` 
    };
    return result;
  }
  
  // Check for template warnings
  if (template.category === 'UTILITY' && campaign.totals?.totalRecipients > 1000) {
    result.warnings.push({
      code: 'UTILITY_HIGH_VOLUME',
      message: 'UTILITY templates may have higher failure rates at scale'
    });
  }
  
  result.passed = true;
  result.template = {
    id: template._id,
    name: template.name,
    status: template.status,
    category: template.category
  };
  
  return result;
}

/**
 * Validate recipient count and quality
 */
async function validateRecipients(campaign) {
  const result = { passed: false, warnings: [] };
  
  let totalRecipients = campaign.totals?.totalRecipients || 0;
  
  // If using contacts array
  if (campaign.contacts && campaign.contacts.length > 0) {
    totalRecipients = campaign.contacts.length;
    
    // Verify all contacts exist
    const validContacts = await Contact.countDocuments({
      _id: { $in: campaign.contacts },
      workspace: campaign.workspace
    });
    
    if (validContacts !== campaign.contacts.length) {
      result.warnings.push({
        code: 'INVALID_CONTACTS',
        message: `${campaign.contacts.length - validContacts} contacts no longer exist`
      });
      totalRecipients = validContacts;
    }
    
    // Check for opted-out contacts
    const optedOutCount = await Contact.countDocuments({
      _id: { $in: campaign.contacts },
      workspace: campaign.workspace,
      optedOut: true
    });
    
    if (optedOutCount > 0) {
      result.warnings.push({
        code: 'OPTED_OUT_CONTACTS',
        message: `${optedOutCount} contacts have opted out and will be skipped`
      });
      totalRecipients -= optedOutCount;
    }
  }
  
  // Minimum check
  if (totalRecipients === 0) {
    result.error = { code: 'NO_RECIPIENTS', message: 'Campaign has no valid recipients' };
    return result;
  }
  
  // Maximum sanity check
  if (totalRecipients > 1000000) {
    result.error = { 
      code: 'TOO_MANY_RECIPIENTS', 
      message: `${totalRecipients} recipients exceeds maximum of 1,000,000` 
    };
    return result;
  }
  
  result.passed = true;
  result.recipients = {
    total: totalRecipients,
    validContacts: totalRecipients
  };
  
  return result;
}

/**
 * Validate WABA account health
 */
async function validateAccountHealth(workspace) {
  const result = { passed: false, warnings: [] };
  
  // Check account blocked
  if (workspace.esbFlow?.accountBlocked) {
    result.error = { 
      code: 'ACCOUNT_BLOCKED', 
      message: workspace.esbFlow?.accountBlockedReason || 'Account is blocked'
    };
    return result;
  }
  
  // Check Meta account status
  const accountStatus = workspace.esbFlow?.metaAccountStatus || 'ACTIVE';
  if (accountStatus !== 'ACTIVE') {
    result.error = { 
      code: 'ACCOUNT_NOT_ACTIVE', 
      message: `Account status is ${accountStatus}` 
    };
    return result;
  }
  
  // Check capability blocked
  if (workspace.esbFlow?.capabilityBlocked) {
    result.error = { 
      code: 'CAPABILITY_BLOCKED', 
      message: workspace.esbFlow?.capabilityBlockedReason || 'Messaging capability is blocked'
    };
    return result;
  }
  
  // Check token expiry
  if (workspace.esbFlow?.systemUserTokenExpiry) {
    const now = new Date();
    const tokenExpiry = new Date(workspace.esbFlow.systemUserTokenExpiry);
    const hoursRemaining = (tokenExpiry - now) / (1000 * 60 * 60);
    
    if (now > tokenExpiry) {
      result.error = { code: 'TOKEN_EXPIRED', message: 'Access token has expired' };
      return result;
    }
    
    if (hoursRemaining < 24) {
      result.warnings.push({
        code: 'TOKEN_EXPIRING_SOON',
        message: `Token expires in ${Math.round(hoursRemaining)} hours`
      });
    }
  }
  
  // Check WhatsApp connection
  const isConnected = workspace.whatsappConnected || 
    workspace.esbFlow?.status === 'completed';
  
  if (!isConnected) {
    result.error = { code: 'NOT_CONNECTED', message: 'WhatsApp is not connected' };
    return result;
  }
  
  result.passed = true;
  result.account = {
    status: accountStatus,
    connected: isConnected
  };
  
  return result;
}

/**
 * Validate phone quality rating and messaging tier
 */
async function validatePhoneTier(workspace, campaign) {
  const result = { passed: false, warnings: [] };
  
  const qualityRating = workspace.qualityRating || 
    workspace.bspQualityRating || 
    'UNKNOWN';
  
  const messagingTier = workspace.messagingLimitTier || 
    workspace.bspMessagingTier || 
    'TIER_NOT_SET';
  
  // Quality rating checks
  if (qualityRating === 'RED') {
    result.error = { 
      code: 'QUALITY_RED', 
      message: 'Phone quality rating is RED - campaigns are blocked to prevent further degradation'
    };
    return result;
  }
  
  if (qualityRating === 'YELLOW') {
    result.warnings.push({
      code: 'QUALITY_YELLOW',
      message: 'Phone quality rating is YELLOW - consider reducing campaign volume'
    });
  }
  
  // Messaging tier vs recipient count check
  const tierLimit = MESSAGING_TIER_LIMITS[messagingTier] || 250;
  const recipientCount = campaign.totals?.totalRecipients || campaign.contacts?.length || 0;
  
  if (tierLimit !== Infinity && recipientCount > tierLimit) {
    result.error = { 
      code: 'TIER_LIMIT_EXCEEDED', 
      message: `Campaign has ${recipientCount} recipients but messaging tier ${messagingTier} allows only ${tierLimit} per 24 hours`
    };
    return result;
  }
  
  // Warn if close to tier limit
  if (tierLimit !== Infinity && recipientCount > tierLimit * 0.8) {
    result.warnings.push({
      code: 'APPROACHING_TIER_LIMIT',
      message: `Using ${Math.round((recipientCount / tierLimit) * 100)}% of daily tier limit`
    });
  }
  
  result.passed = true;
  result.tier = {
    qualityRating,
    qualityStatus: QUALITY_RATINGS[qualityRating] || 'unknown',
    messagingTier,
    tierLimit,
    recipientCount
  };
  
  return result;
}

/**
 * Validate workspace message limits
 */
async function validateWorkspaceLimits(workspace, campaign) {
  const result = { passed: false, warnings: [] };
  
  const plan = workspace.plan || 'free';
  const recipientCount = campaign.totals?.totalRecipients || campaign.contacts?.length || 0;
  
  // Get plan limits
  const PLAN_LIMITS = {
    free: { messagesDaily: 1000, messagesMonthly: 30000 },
    basic: { messagesDaily: 10000, messagesMonthly: 300000 },
    premium: { messagesDaily: 100000, messagesMonthly: 3000000 },
    enterprise: { messagesDaily: -1, messagesMonthly: -1 }
  };
  
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const messagesDaily = workspace.usage?.messagesDaily || 0;
  const messagesMonthly = workspace.usage?.messagesThisMonth || 0;
  
  // Daily limit check
  if (limits.messagesDaily !== -1) {
    const dailyRemaining = limits.messagesDaily - messagesDaily;
    
    if (recipientCount > dailyRemaining) {
      result.error = { 
        code: 'DAILY_LIMIT_EXCEEDED', 
        message: `Need ${recipientCount} messages, only ${Math.max(0, dailyRemaining)} available today`
      };
      return result;
    }
    
    if (dailyRemaining < recipientCount * 1.1) {
      result.warnings.push({
        code: 'DAILY_LIMIT_CLOSE',
        message: `Only ${dailyRemaining} daily messages remaining after this campaign`
      });
    }
  }
  
  // Monthly limit check
  if (limits.messagesMonthly !== -1) {
    const monthlyRemaining = limits.messagesMonthly - messagesMonthly;
    
    if (recipientCount > monthlyRemaining) {
      result.error = { 
        code: 'MONTHLY_LIMIT_EXCEEDED', 
        message: `Need ${recipientCount} messages, only ${Math.max(0, monthlyRemaining)} available this month`
      };
      return result;
    }
  }
  
  result.passed = true;
  result.limits = {
    plan,
    dailyLimit: limits.messagesDaily,
    monthlyLimit: limits.messagesMonthly,
    dailyUsed: messagesDaily,
    monthlyUsed: messagesMonthly,
    dailyRemaining: limits.messagesDaily !== -1 ? limits.messagesDaily - messagesDaily : Infinity,
    monthlyRemaining: limits.messagesMonthly !== -1 ? limits.messagesMonthly - messagesMonthly : Infinity
  };
  
  return result;
}

/**
 * Calculate estimated send duration and throughput
 */
async function calculateEstimates(campaign, workspace) {
  const recipientCount = campaign.totals?.totalRecipients || campaign.contacts?.length || 0;
  
  // Calculate batch count
  const batchSize = campaign.batching?.batchSize || 50;
  const totalBatches = Math.ceil(recipientCount / batchSize);
  
  // Calculate estimated duration
  // Assume: 1 second per message (conservative with rate limiting)
  // Batch processing: ~30 seconds per batch including overhead
  const secondsPerBatch = 30;
  const totalSeconds = totalBatches * secondsPerBatch;
  
  // More accurate: messages per minute rate
  const messagesPerMinute = RATE_LIMITS.perMinute;
  const estimatedMinutes = recipientCount / messagesPerMinute;
  
  // Format duration
  const formatDuration = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)} seconds`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours} hours ${mins} minutes`;
  };
  
  return {
    recipientCount,
    batchSize,
    totalBatches,
    estimatedDurationSeconds: Math.round(estimatedMinutes * 60),
    estimatedDuration: formatDuration(estimatedMinutes * 60),
    effectiveRatePerSecond: RATE_LIMITS.perSecond,
    effectiveRatePerMinute: RATE_LIMITS.perMinute,
    
    // For UI display
    display: {
      recipients: recipientCount.toLocaleString(),
      batches: totalBatches.toLocaleString(),
      duration: formatDuration(estimatedMinutes * 60)
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH FINALITY (Task B Support)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get resumable batches for a campaign (Task B - Batch Finality)
 * COMPLETED batches are NEVER returned - they are final
 * @param {String} campaignId - Campaign ID
 * @returns {Array} Array of resumable batch IDs
 */
async function getResumableBatches(campaignId) {
  // CRITICAL: Only return batches that can be resumed
  // COMPLETED batches must NEVER be re-enqueued
  const resumableBatches = await CampaignBatch.find({
    campaign: campaignId,
    status: { $in: ['PENDING', 'FAILED', 'PAUSED'] } // NOT: COMPLETED, PROCESSING, QUEUED
  })
  .select('_id batchIndex status')
  .sort({ batchIndex: 1 });
  
  return resumableBatches;
}

/**
 * Verify batch is not already completed (idempotency check)
 * @param {String} batchId - Batch ID
 * @returns {Object} { canProcess, reason }
 */
async function verifyBatchNotCompleted(batchId) {
  const batch = await CampaignBatch.findById(batchId).select('status batchIndex campaign');
  
  if (!batch) {
    return { canProcess: false, reason: 'BATCH_NOT_FOUND' };
  }
  
  if (batch.status === 'COMPLETED') {
    return { 
      canProcess: false, 
      reason: 'BATCH_ALREADY_COMPLETED',
      batchIndex: batch.batchIndex,
      status: batch.status
    };
  }
  
  if (batch.status === 'PROCESSING') {
    return { 
      canProcess: false, 
      reason: 'BATCH_ALREADY_PROCESSING',
      batchIndex: batch.batchIndex,
      status: batch.status
    };
  }
  
  return { 
    canProcess: true, 
    batchIndex: batch.batchIndex,
    status: batch.status
  };
}

/**
 * Get batch processing status summary for campaign
 * @param {String} campaignId - Campaign ID
 * @returns {Object} Status breakdown
 */
async function getBatchStatusSummary(campaignId) {
  const summary = await CampaignBatch.aggregate([
    { $match: { campaign: campaignId } },
    { $group: { 
      _id: '$status', 
      count: { $sum: 1 },
      recipientCount: { $sum: '$recipientCount' }
    }}
  ]);
  
  const result = {
    PENDING: 0,
    QUEUED: 0,
    PROCESSING: 0,
    COMPLETED: 0,
    FAILED: 0,
    PAUSED: 0,
    total: 0,
    resumable: 0
  };
  
  for (const s of summary) {
    result[s._id] = s.count;
    result.total += s.count;
    
    // Resumable = PENDING + FAILED + PAUSED
    if (['PENDING', 'FAILED', 'PAUSED'].includes(s._id)) {
      result.resumable += s.count;
    }
  }
  
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Main preflight validation
  validateCampaignExecution,
  
  // Individual checks (for granular use)
  validateTemplate,
  validateRecipients,
  validateAccountHealth,
  validatePhoneTier,
  validateWorkspaceLimits,
  calculateEstimates,
  
  // Batch finality (Task B)
  getResumableBatches,
  verifyBatchNotCompleted,
  getBatchStatusSummary,
  
  // Constants
  MESSAGING_TIER_LIMITS,
  QUALITY_RATINGS,
  RATE_LIMITS
};
