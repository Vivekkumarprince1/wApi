const Template = require('../models/Template');
const Contact = require('../models/Contact');
const Workspace = require('../models/Workspace');
const Campaign = require('../models/Campaign');

// ✅ Plan limits - source of truth for enforcement
const PLAN_LIMITS = {
  free: {
    messagesDaily: 1000,
    messagesMonthly: 30000,
    templates: 5,
    campaigns: 5,
    contacts: 1000,
    automations: 3
  },
  basic: {
    messagesDaily: 10000,
    messagesMonthly: 300000,
    templates: 25,
    campaigns: 10,
    contacts: 10000,
    automations: 10
  },
  premium: {
    messagesDaily: 100000,
    messagesMonthly: 3000000,
    templates: 100,
    campaigns: -1, // unlimited
    contacts: 100000,
    automations: 50
  },
  enterprise: {
    messagesDaily: -1, // unlimited
    messagesMonthly: -1,
    templates: -1,
    campaigns: -1,
    contacts: -1,
    automations: -1
  }
};

/**
 * ✅ Validate campaign creation (Interakt-style)
 * Checks: template approval, limits, account status, tokens
 */
async function validateCampaignCreation(workspace, campaignData) {
  const errors = [];
  
  // 1️⃣ Check workspace exists and is active
  if (!workspace) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }

  // 2️⃣ Check account status
  if (workspace.esbFlow?.accountBlocked) {
    throw new Error('ACCOUNT_BLOCKED: ' + (workspace.esbFlow?.accountBlockedReason || 'Unknown reason'));
  }

  // Allow undefined status to pass as ACTIVE (legacy workspaces)
  const accountStatus = workspace.esbFlow?.metaAccountStatus || 'ACTIVE';
  if (accountStatus !== 'ACTIVE') {
    throw new Error('ACCOUNT_NOT_ACTIVE: Account status is ' + accountStatus);
  }

  // 3️⃣ Check token expiry
  if (workspace.esbFlow?.systemUserTokenExpiry) {
    const now = new Date();
    const tokenExpiry = new Date(workspace.esbFlow.systemUserTokenExpiry);
    if (now > tokenExpiry) {
      throw new Error('TOKEN_EXPIRED');
    }
  }

  // 4️⃣ Check template is provided and APPROVED
  if (!campaignData.template) {
    throw new Error('TEMPLATE_REQUIRED');
  }

  const template = await Template.findOne({
    _id: campaignData.template,
    workspace: workspace._id
  });

  if (!template) {
    throw new Error('TEMPLATE_NOT_FOUND');
  }

  // ✅ CRITICAL: Template MUST be APPROVED
  if (template.status !== 'APPROVED') {
    throw new Error(`TEMPLATE_NOT_APPROVED: Status is ${template.status}`);
  }

  // 5️⃣ Validate contact list
  if (!campaignData.contacts || campaignData.contacts.length === 0) {
    throw new Error('CONTACTS_REQUIRED');
  }

  // Check for duplicates
  const uniqueContacts = new Set(campaignData.contacts);
  if (uniqueContacts.size !== campaignData.contacts.length) {
    throw new Error('DUPLICATE_CONTACTS: Contact list has duplicates');
  }

  // Verify all contacts exist and belong to workspace
  const contacts = await Contact.find({
    _id: { $in: campaignData.contacts },
    workspace: workspace._id
  });

  if (contacts.length !== campaignData.contacts.length) {
    throw new Error('INVALID_CONTACTS: Some contacts not found or do not belong to workspace');
  }

  // ✅ Validate contact phone numbers
  for (const contact of contacts) {
    if (!contact.phone || !/^\+?[1-9]\d{1,14}$/.test(contact.phone.replace(/\D/g, ''))) {
      throw new Error(`INVALID_PHONE_NUMBER: ${contact.phone}`);
    }
  }

  // 6️⃣ Validate variable mapping (if template uses variables)
  if (template.variables && template.variables.length > 0) {
    if (!campaignData.variableMapping || typeof campaignData.variableMapping !== 'object') {
      throw new Error('VARIABLE_MAPPING_REQUIRED: Template has variables but no mapping provided');
    }

    for (const variable of template.variables) {
      if (!campaignData.variableMapping[variable]) {
        throw new Error(`VARIABLE_NOT_MAPPED: ${variable} is required but not mapped`);
      }
    }
  }

  // 7️⃣ ✅ CRITICAL: Check message limits BEFORE sending
  const plan = workspace.plan || 'free';
  const planLimits = PLAN_LIMITS[plan];

  const messageCount = campaignData.contacts.length;

  // Daily limit check
  if (planLimits.messagesDaily !== -1) {
    const messagesDaily = workspace.usage?.messagesDaily || 0;
    const dailyRemaining = planLimits.messagesDaily - messagesDaily;

    if (messageCount > dailyRemaining) {
      throw new Error(
        `DAILY_LIMIT_EXCEEDED: Need ${messageCount} messages, only ${dailyRemaining} available today`
      );
    }
  }

  // Monthly limit check
  if (planLimits.messagesMonthly !== -1) {
    const messagesMonthly = workspace.usage?.messagesThisMonth || 0;
    const monthlyRemaining = planLimits.messagesMonthly - messagesMonthly;

    if (messageCount > monthlyRemaining) {
      throw new Error(
        `MONTHLY_LIMIT_EXCEEDED: Need ${messageCount} messages, only ${monthlyRemaining} available this month`
      );
    }
  }

  // 8️⃣ Check campaign limit
  if (planLimits.campaigns !== -1) {
    const activeCampaigns = await Campaign.countDocuments({
      workspace: workspace._id,
      status: { $in: ['draft', 'queued', 'sending'] }
    });

    if (activeCampaigns >= planLimits.campaigns) {
      throw new Error(`CAMPAIGN_LIMIT_EXCEEDED: Cannot create more than ${planLimits.campaigns} active campaigns`);
    }
  }

  // 9️⃣ Check ESB flow or WABA credentials
  const isConnected = (workspace.esbFlow?.status === 'completed') || (workspace.whatsappAccessToken && workspace.whatsappPhoneNumberId);
  if (!isConnected) {
    throw new Error('WHATSAPP_NOT_CONNECTED: Complete WhatsApp setup first');
  }

  return { valid: true, message: 'Campaign is valid' };
}

/**
 * ✅ Check if campaign can start sending (runtime checks)
 */
async function validateCampaignStart(campaign) {
  const workspace = await Workspace.findById(campaign.workspace);
  const template = await Template.findById(campaign.template);

  // Check template is still APPROVED
  if (!template || template.status !== 'APPROVED') {
    return {
      valid: false,
      reason: 'TEMPLATE_REVOKED',
      message: 'Template is no longer approved'
    };
  }

  // Check account is still active
  if (workspace.esbFlow?.accountBlocked) {
    return {
      valid: false,
      reason: 'ACCOUNT_BLOCKED',
      message: 'Account is blocked'
    };
  }

  const accountStatus = workspace.esbFlow?.metaAccountStatus || 'ACTIVE';
  if (accountStatus !== 'ACTIVE') {
    return {
      valid: false,
      reason: 'ACCOUNT_NOT_ACTIVE',
      message: `Account status is ${accountStatus}`
    };
  }

  // Check token
  if (workspace.esbFlow?.systemUserTokenExpiry) {
    const now = new Date();
    const tokenExpiry = new Date(workspace.esbFlow.systemUserTokenExpiry);
    if (now > tokenExpiry) {
      return {
        valid: false,
        reason: 'TOKEN_EXPIRED',
        message: 'WhatsApp token has expired'
      };
    }
  }

  // Check message limits still available
  const plan = workspace.plan || 'free';
  const planLimits = PLAN_LIMITS[plan];
  const remainingMessages = campaign.totalContacts - campaign.sentCount;

  if (planLimits.messagesDaily !== -1) {
    const messagesDaily = workspace.usage?.messagesDaily || 0;
    const dailyRemaining = planLimits.messagesDaily - messagesDaily;

    if (remainingMessages > dailyRemaining) {
      return {
        valid: false,
        reason: 'DAILY_LIMIT_EXCEEDED',
        message: `Only ${dailyRemaining} messages available today, need ${remainingMessages}`
      };
    }
  }

  return { valid: true };
}

/**
 * ✅ Check if campaign should auto-pause
 */
async function checkShouldPauseCampaign(campaign) {
  const workspace = await Workspace.findById(campaign.workspace);
  const template = await Template.findById(campaign.template);

  // Template revoked
  if (!template || template.status !== 'APPROVED') {
    return { shouldPause: true, reason: 'TEMPLATE_REVOKED' };
  }

  // Account disabled
  if (workspace.esbFlow?.accountBlocked) {
    return { shouldPause: true, reason: 'ACCOUNT_BLOCKED' };
  }

  const accountStatus = workspace.esbFlow?.metaAccountStatus || 'ACTIVE';
  if (accountStatus !== 'ACTIVE') {
    return { shouldPause: true, reason: 'ACCOUNT_NOT_ACTIVE' };
  }

  // Token expired
  if (workspace.esbFlow?.systemUserTokenExpiry) {
    const now = new Date();
    const tokenExpiry = new Date(workspace.esbFlow.systemUserTokenExpiry);
    if (now > tokenExpiry) {
      return { shouldPause: true, reason: 'TOKEN_EXPIRED' };
    }
  }

  // Message limits exceeded
  const plan = workspace.plan || 'free';
  const planLimits = PLAN_LIMITS[plan];
  const remainingMessages = campaign.totalContacts - campaign.sentCount;

  if (planLimits.messagesDaily !== -1) {
    const messagesDaily = workspace.usage?.messagesDaily || 0;
    const dailyRemaining = planLimits.messagesDaily - messagesDaily;

    if (remainingMessages > dailyRemaining && dailyRemaining <= 0) {
      return { shouldPause: true, reason: 'DAILY_LIMIT_REACHED' };
    }
  }

  if (planLimits.messagesMonthly !== -1) {
    const messagesMonthly = workspace.usage?.messagesThisMonth || 0;
    const monthlyRemaining = planLimits.messagesMonthly - messagesMonthly;

    if (remainingMessages > monthlyRemaining && monthlyRemaining <= 0) {
      return { shouldPause: true, reason: 'MONTHLY_LIMIT_REACHED' };
    }
  }

  return { shouldPause: false };
}

module.exports = {
  validateCampaignCreation,
  validateCampaignStart,
  checkShouldPauseCampaign,
  PLAN_LIMITS
};
