const Template = require('../models/Template');
const Workspace = require('../models/Workspace');
const WhatsAppAd = require('../models/WhatsAppAd');

/**
 * ✅ Plan limits for ads - source of truth
 * Enforced on backend, Meta approvals do NOT override
 */
const ADS_PLAN_LIMITS = {
  free: {
    adsEnabled: false, // Ads not available
    maxActiveAds: 0,
    maxMonthlySpend: 0, // cents (if enabled)
    maxConcurrentCampaigns: 0
  },
  basic: {
    adsEnabled: true,
    maxActiveAds: 2,
    maxMonthlySpend: 50000, // $500/month
    maxConcurrentCampaigns: 1
  },
  premium: {
    adsEnabled: true,
    maxActiveAds: 10,
    maxMonthlySpend: 500000, // $5000/month
    maxConcurrentCampaigns: 5
  },
  enterprise: {
    adsEnabled: true,
    maxActiveAds: -1, // unlimited
    maxMonthlySpend: -1, // unlimited
    maxConcurrentCampaigns: -1
  }
};

/**
 * ✅ Validate ads prerequisites (Interakt-style)
 * Returns: { enabled: boolean, reason?: string }
 */
async function validateAdsPrerequisites(workspace) {
  if (!workspace) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }

  const result = {
    enabled: false,
    checks: {},
    errors: []
  };

  // ✅ 1. Check plan allows ads
  const planLimits = ADS_PLAN_LIMITS[workspace.plan] || ADS_PLAN_LIMITS.free;
  if (!planLimits.adsEnabled) {
    result.checks.plan = {
      pass: false,
      reason: `Plan ${workspace.plan} does not include WhatsApp Ads. Upgrade to Basic or higher.`
    };
    result.errors.push('ADS_NOT_ENABLED_FOR_PLAN');
  } else {
    result.checks.plan = { pass: true };
  }

  // ✅ 2. Check workspace subscription is active
  if (workspace.subscription?.status !== 'active') {
    result.checks.subscription = {
      pass: false,
      reason: `Subscription status: ${workspace.subscription?.status}. Activate to continue.`
    };
    result.errors.push('SUBSCRIPTION_INACTIVE');
  } else {
    result.checks.subscription = { pass: true };
  }

  // ✅ 3. Check account is not blocked
  if (workspace.esbFlow?.accountBlocked) {
    result.checks.account = {
      pass: false,
      reason: `Account blocked: ${workspace.esbFlow.accountBlockedReason}`
    };
    result.errors.push('ACCOUNT_BLOCKED');
  } else if (workspace.esbFlow?.metaAccountStatus !== 'ACTIVE') {
    result.checks.account = {
      pass: false,
      reason: `Account status: ${workspace.esbFlow?.metaAccountStatus}`
    };
    result.errors.push('ACCOUNT_NOT_ACTIVE');
  } else {
    result.checks.account = { pass: true };
  }

  // ✅ 4. Check token is not expired
  if (workspace.esbFlow?.systemUserTokenExpiry) {
    const now = new Date();
    const tokenExpiry = new Date(workspace.esbFlow.systemUserTokenExpiry);
    if (now > tokenExpiry) {
      result.checks.token = {
        pass: false,
        reason: 'System user token expired. Refresh required.'
      };
      result.errors.push('TOKEN_EXPIRED');
    } else {
      result.checks.token = { pass: true };
    }
  } else {
    result.checks.token = {
      pass: false,
      reason: 'System user token not configured.'
    };
    result.errors.push('TOKEN_NOT_CONFIGURED');
  }

  // ✅ 5. Check WABA is configured
  if (!workspace.esbFlow?.phoneNumberIdForOTP) {
    result.checks.waba = {
      pass: false,
      reason: 'WhatsApp Business Account not fully configured.'
    };
    result.errors.push('WABA_NOT_CONFIGURED');
  } else {
    result.checks.waba = { pass: true };
  }

  // ✅ 6. Check phone number status = usable
  // TODO: Add phone number verification endpoint to verify status
  result.checks.phoneNumber = {
    pass: true // Assuming already verified during onboarding
  };

  // ✅ 7. Check WhatsApp capability enabled
  const capabilities = workspace.esbFlow?.metaCapabilities;
  if (capabilities && !capabilities.whatsapp) {
    result.checks.capability = {
      pass: false,
      reason: 'WhatsApp capability not enabled for this account.'
    };
    result.errors.push('CAPABILITY_REVOKED');
  } else {
    result.checks.capability = { pass: true };
  }

  // ✅ 8. Check at least one APPROVED template exists
  const approvedTemplate = await Template.findOne({
    workspace: workspace._id,
    status: 'APPROVED'
  });

  if (!approvedTemplate) {
    result.checks.template = {
      pass: false,
      reason: 'No approved WhatsApp template found. Create and approve a template first.'
    };
    result.errors.push('NO_APPROVED_TEMPLATE');
  } else {
    result.checks.template = { pass: true };
  }

  // ✅ Overall result
  result.enabled = result.errors.length === 0;

  return result;
}

/**
 * ✅ Validate ads creation against plan limits
 */
async function validateAdsCreation(workspace, adsData) {
  const errors = [];
  
  // First check prerequisites
  const prereqs = await validateAdsPrerequisites(workspace);
  if (!prereqs.enabled) {
    throw new Error(prereqs.errors[0]); // Throw first error
  }

  // Check plan limits
  const planLimits = ADS_PLAN_LIMITS[workspace.plan];
  
  // Count active ads
  const activeAdsCount = await WhatsAppAd.countDocuments({
    workspace: workspace._id,
    status: 'active'
  });

  if (planLimits.maxActiveAds !== -1 && activeAdsCount >= planLimits.maxActiveAds) {
    throw new Error(`MAX_ACTIVE_ADS_EXCEEDED: You have ${activeAdsCount}/${planLimits.maxActiveAds} active ads`);
  }

  // Check template is APPROVED
  if (!adsData.template) {
    throw new Error('TEMPLATE_REQUIRED');
  }

  const template = await Template.findOne({
    _id: adsData.template,
    workspace: workspace._id,
    status: 'APPROVED'
  });

  if (!template) {
    throw new Error('TEMPLATE_NOT_APPROVED: Template must be APPROVED status');
  }

  // Check daily budget is reasonable
  if (adsData.budget < 100) { // Min $1.00
    throw new Error('BUDGET_TOO_LOW: Minimum daily budget is $1.00 (100 cents)');
  }

  if (adsData.budget > 10000000) { // Max $100,000/day
    throw new Error('BUDGET_TOO_HIGH: Maximum daily budget is $100,000');
  }

  // Check schedule dates
  const now = new Date();
  if (new Date(adsData.scheduleStart) < now) {
    throw new Error('INVALID_SCHEDULE: Start date must be in the future');
  }

  if (adsData.scheduleEnd && new Date(adsData.scheduleEnd) <= new Date(adsData.scheduleStart)) {
    throw new Error('INVALID_SCHEDULE: End date must be after start date');
  }

  return true;
}

/**
 * ✅ Check if ad should be auto-paused
 * Returns: { shouldPause: boolean, reason?: string }
 */
async function checkShouldPauseAd(workspace, ad) {
  // Refresh workspace data
  const freshWorkspace = await Workspace.findById(workspace._id);
  
  const checks = {
    templateRevoked: false,
    accountBlocked: false,
    tokenExpired: false,
    subscriptionInactive: false,
    capabilityRevoked: false,
    spendLimitReached: false
  };

  // 1. Template revoked?
  const template = await Template.findById(ad.template);
  if (!template || template.status !== 'APPROVED') {
    checks.templateRevoked = true;
  }

  // 2. Account blocked?
  if (freshWorkspace.esbFlow?.accountBlocked) {
    checks.accountBlocked = true;
  }

  // 3. Token expired?
  if (freshWorkspace.esbFlow?.systemUserTokenExpiry) {
    const now = new Date();
    if (now > new Date(freshWorkspace.esbFlow.systemUserTokenExpiry)) {
      checks.tokenExpired = true;
    }
  }

  // 4. Subscription inactive?
  if (freshWorkspace.subscription?.status !== 'active') {
    checks.subscriptionInactive = true;
  }

  // 5. Capability revoked?
  if (freshWorkspace.esbFlow?.capabilityBlocked) {
    checks.capabilityRevoked = true;
  }

  // 6. Monthly spend limit reached?
  const planLimits = ADS_PLAN_LIMITS[freshWorkspace.plan];
  if (planLimits.maxMonthlySpend > 0) {
    // Count spending this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    
    const monthlySpend = await WhatsAppAd.aggregate([
      {
        $match: {
          workspace: freshWorkspace._id,
          metaStatusUpdatedAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$spentAmount' }
        }
      }
    ]);

    const spent = monthlySpend[0]?.totalSpent || 0;
    if (spent >= planLimits.maxMonthlySpend) {
      checks.spendLimitReached = true;
    }
  }

  // Determine if should pause
  const shouldPause = Object.values(checks).some(v => v === true);
  let reason = null;

  if (checks.templateRevoked) reason = 'TEMPLATE_REVOKED';
  else if (checks.accountBlocked) reason = 'ACCOUNT_BLOCKED';
  else if (checks.tokenExpired) reason = 'TOKEN_EXPIRED';
  else if (checks.subscriptionInactive) reason = 'SUBSCRIPTION_INACTIVE';
  else if (checks.capabilityRevoked) reason = 'CAPABILITY_REVOKED';
  else if (checks.spendLimitReached) reason = 'SPEND_LIMIT_REACHED';

  return { shouldPause, reason, checks };
}

module.exports = {
  validateAdsPrerequisites,
  validateAdsCreation,
  checkShouldPauseAd,
  ADS_PLAN_LIMITS
};
