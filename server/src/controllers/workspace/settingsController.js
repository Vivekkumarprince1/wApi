const { Workspace } = require('../../models');
const { encryptToken, isEncrypted } = require('../../utils/tokenEncryption');

// BSP-only hardening: when enabled, tenants must NOT be able to configure
// their own Meta / WhatsApp credentials. All Meta assets are owned and
// managed centrally by the BSP under a single parent WABA.
const BSP_ONLY = process.env.BSP_ONLY !== 'false';

// Initialize WABA settings from environment variables (for development)
async function initializeWABAFromEnv(req, res, next) {
  try {
    if (BSP_ONLY) {
      return res.status(410).json({
        success: false,
        message: 'Per-workspace WABA initialization is disabled in BSP mode. WhatsApp is provisioned centrally under the BSP account.',
        code: 'BSP_ONLY_WABA_ENV_DISABLED'
      });
    }
    const workspace = await Workspace.findById(req.user.workspace);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Only allow if no credentials already set
    if (workspace.whatsappAccessToken || workspace.wabaId) {
      return res.status(400).json({
        message: 'Workspace already has WABA credentials configured',
        hint: 'Clear existing credentials first if you want to reset'
      });
    }

    // Populate from environment variables
    const accessToken = process.env.GUPSHUP_API_KEY;
    const wabaId = process.env.GUPSHUP_APP_ID;
    const phoneNumberId = process.env.GUPSHUP_SOURCE_NUMBER;
    const verifyToken = '';
    const appSecret = process.env.GUPSHUP_PARTNER_TOKEN;

    if (!accessToken || !wabaId || !phoneNumberId) {
      return res.status(400).json({
        message: 'Missing required environment variables',
        required: ['GUPSHUP_API_KEY', 'GUPSHUP_APP_ID', 'GUPSHUP_SOURCE_NUMBER'],
        hint: 'Set these in your .env file'
      });
    }

    // Update workspace
    // WHY: Tokens must be encrypted at rest (Meta/BSP compliance)
    workspace.whatsappAccessToken = isEncrypted(accessToken)
      ? accessToken
      : encryptToken(accessToken, workspace._id.toString());
    workspace.wabaId = wabaId;
    workspace.whatsappPhoneNumberId = phoneNumberId;
    workspace.whatsappVerifyToken = verifyToken || workspace.whatsappVerifyToken;
    workspace.connectedAt = new Date();

    await workspace.save();

    res.json({
      success: true,
      message: 'WABA credentials initialized from environment variables',
      workspace: {
        wabaId: workspace.wabaId,
        phoneNumberId: workspace.whatsappPhoneNumberId,
        maskedToken: `****${workspace.whatsappAccessToken.slice(-4)}`,
        connectedAt: workspace.connectedAt,
        verifyToken: workspace.whatsappVerifyToken
      }
    });
  } catch (err) {
    next(err);
  }
}

// Get WhatsApp number setup status
async function getWhatsAppNumberStatus(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    res.json({
      success: true,
      connectedNumber: workspace.whatsappSetup?.requestedNumber || null,
      status: workspace.whatsappSetup?.status || null,
      connectedAt: workspace.whatsappSetup?.completedAt || null,
      hasExistingAccount: workspace.whatsappSetup?.hasExistingAccount || false
    });
  } catch (err) {
    next(err);
  }
}

// Get WABA settings for current workspace
async function getWABASettings(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Mask sensitive token (only show last 4 chars)
    const maskedToken = workspace.whatsappAccessToken
      ? `****${workspace.whatsappAccessToken.slice(-4)}`
      : null;

    res.json({
      whatsappPhoneNumberId: workspace.whatsappPhoneNumberId || workspace.bspPhoneNumberId || null,
      whatsappPhoneNumber: workspace.bspDisplayPhoneNumber || workspace.whatsappPhoneNumber || null,
      businessName: workspace.bspVerifiedName || workspace.verifiedName || null,
      whatsappVerifyToken: workspace.whatsappVerifyToken || null,
      wabaId: workspace.wabaId || workspace.bspWabaId || null,
      businessAccountId: workspace.businessAccountId || null,
      connectedAt: workspace.connectedAt || workspace.bspOnboardedAt || null,
      hasToken: !!workspace.whatsappAccessToken,
      isBspManaged: !!workspace.bspManaged,
      maskedToken,
      profile: workspace.businessProfile || { businessName: workspace.bspVerifiedName || workspace.verifiedName || '' }
    });
  } catch (err) {
    next(err);
  }
}

// Update WABA settings for current workspace
async function updateWABASettings(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const isWorkspaceOwner = String(workspace.owner) === String(req.user._id) || req.user.role === 'owner';
    const canUpdateBspProfile = isWorkspaceOwner || req.user.role === 'admin' || req.user.role === 'super_admin';

    const {
      whatsappAccessToken,
      whatsappPhoneNumberId,
      whatsappVerifyToken,
      wabaId,
      businessAccountId,
      profile
    } = req.body;

    if (BSP_ONLY) {
      const hasCredentialMutation =
        whatsappAccessToken !== undefined ||
        whatsappPhoneNumberId !== undefined ||
        whatsappVerifyToken !== undefined ||
        wabaId !== undefined ||
        businessAccountId !== undefined;

      if (hasCredentialMutation) {
        return res.status(410).json({
          success: false,
          message: 'WhatsApp connection is fully managed by the BSP. You cannot edit WABA IDs, phone_number_id, or tokens from this workspace.',
          code: 'BSP_ONLY_WABA_MUTATION_DISABLED'
        });
      }

      if (profile !== undefined) {
        if (!canUpdateBspProfile) {
          return res.status(403).json({ message: 'Insufficient permissions to update WhatsApp profile' });
        }

        workspace.businessProfile = profile;
        await workspace.save();

        return res.json({
          success: true,
          message: 'WhatsApp business profile updated successfully',
          settings: {
            profile: workspace.businessProfile || {}
          }
        });
      }

      return res.status(400).json({
        success: false,
        message: 'No updatable fields provided'
      });
    }

    // In non-BSP mode, only owner can update WABA settings
    if (!isWorkspaceOwner) {
      return res.status(403).json({ message: 'Only workspace owner can update WABA settings' });
    }

    // Update fields if provided
    if (whatsappAccessToken !== undefined) {
      // WHY: Tokens must be encrypted at rest (Meta/BSP compliance)
      workspace.whatsappAccessToken = isEncrypted(whatsappAccessToken)
        ? whatsappAccessToken
        : encryptToken(whatsappAccessToken, workspace._id.toString());
    }
    if (whatsappPhoneNumberId !== undefined) {
      workspace.whatsappPhoneNumberId = whatsappPhoneNumberId;
    }
    if (whatsappVerifyToken !== undefined) {
      workspace.whatsappVerifyToken = whatsappVerifyToken;
    }
    if (wabaId !== undefined) {
      workspace.wabaId = wabaId;
    }
    if (businessAccountId !== undefined) {
      workspace.businessAccountId = businessAccountId;
    }
    if (profile !== undefined) {
      workspace.businessProfile = profile;
    }

    // Set connected timestamp if this is the first time setting credentials
    if (!workspace.connectedAt && whatsappAccessToken && whatsappPhoneNumberId) {
      workspace.connectedAt = new Date();
    }

    await workspace.save();

    // Return masked response
    const maskedToken = workspace.whatsappAccessToken
      ? `****${workspace.whatsappAccessToken.slice(-4)}`
      : null;

    res.json({
      message: 'WABA settings updated successfully',
      settings: {
        whatsappPhoneNumberId: workspace.whatsappPhoneNumberId,
        whatsappVerifyToken: workspace.whatsappVerifyToken,
        wabaId: workspace.wabaId,
        businessAccountId: workspace.businessAccountId,
        profile: workspace.businessProfile || {},
        connectedAt: workspace.connectedAt,
        hasToken: !!workspace.whatsappAccessToken,
        maskedToken
      }
    });
  } catch (err) {
    next(err);
  }
}

// Test WABA connection
async function testWABAConnection(req, res, next) {
  try {
    if (BSP_ONLY) {
      return res.status(410).json({
        success: false,
        message: 'Direct WABA connection tests are disabled in BSP mode. Use BSP health dashboards instead.',
        code: 'BSP_ONLY_WABA_TEST_DISABLED'
      });
    }
    const workspace = await Workspace.findById(req.user.workspace);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    if (!workspace.whatsappAccessToken || !workspace.whatsappPhoneNumberId) {
      return res.status(400).json({
        message: 'WABA credentials not configured',
        success: false
      });
    }

    // Test by fetching phone number info from Meta API
    const gupshupService = require('../../services/bsp/gupshupService');
    const axios = require('axios');

    try {
      const response = await axios.get(
        `https://graph.facebook.com/v21.0/${workspace.whatsappPhoneNumberId}`,
        {
          params: { fields: 'verified_name,code_verification_status,display_phone_number' },
          headers: { Authorization: `Bearer ${workspace.whatsappAccessToken}` }
        }
      );

      res.json({
        success: true,
        message: 'WABA connection successful',
        phoneInfo: response.data
      });
    } catch (apiError) {
      console.error('WABA test failed:', apiError.response?.data || apiError.message);
      res.status(400).json({
        success: false,
        message: apiError.response?.data?.error?.message || 'Connection test failed',
        error: apiError.response?.data
      });
    }
  } catch (err) {
    next(err);
  }
}

// Create initial WABA settings (alias for update)
async function createWABASettings(req, res, next) {
  // Creating is the same as updating for WABA settings
  return updateWABASettings(req, res, next);
}

// Debug Meta API credentials and find correct WABA ID
async function debugMetaCredentials(req, res, next) {
  try {
    if (BSP_ONLY) {
      return res.status(410).json({
        success: false,
        message: 'Per-workspace Meta credential debugging is disabled in BSP mode. Meta apps and tokens are owned by the BSP only.',
        code: 'BSP_ONLY_META_DEBUG_DISABLED'
      });
    }
    const workspace = await Workspace.findById(req.user.workspace);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const accessToken = workspace.gupshupIdentity?.appApiKey;
    const phoneNumberId = workspace.gupshupIdentity?.source;

    if (!accessToken) {
      return res.status(400).json({
        message: 'CREDENTIALS_MISSING: No access token configured',
        hint: 'Configure gupshupIdentity in workspace settings'
      });
    }

    const gupshupService = require('../../services/bsp/gupshupService');

    // Get debug info
    const debugInfo = await gupshupService.debugTokenInfo(accessToken);

    // Try to get WABA from phone number if available
    let wabaFromPhone = null;
    if (phoneNumberId) {
      try {
        wabaFromPhone = await gupshupService.getWABAFromPhoneNumber(accessToken, phoneNumberId);
      } catch (e) {
        wabaFromPhone = { error: e.message };
      }
    }

    res.json({
      success: true,
      currentConfig: {
        phoneNumberId: phoneNumberId || 'Not configured',
        wabaId: workspace.wabaId || process.env.GUPSHUP_APP_ID || 'Not configured',
        hasAccessToken: !!accessToken
      },
      debugInfo,
      wabaFromPhone,
      recommendations: generateRecommendations(debugInfo, wabaFromPhone)
    });
  } catch (err) {
    next(err);
  }
}

function generateRecommendations(debugInfo, wabaFromPhone) {
  const recommendations = [];

  if (!debugInfo.tokenValid) {
    recommendations.push('❌ Your access token is invalid or expired. Generate a new one from Meta Developer Portal.');
  }

  if (debugInfo.wabaAccounts.length > 0) {
    recommendations.push(`✅ Found ${debugInfo.wabaAccounts.length} app account(s). Use one of these IDs as GUPSHUP_APP_ID:`);
    debugInfo.wabaAccounts.forEach(waba => {
      recommendations.push(`   - WABA ID: ${waba.id} (${waba.name})`);
    });
  }

  if (wabaFromPhone?.wabaId) {
    recommendations.push(`✅ Found WABA ID from phone number: ${wabaFromPhone.wabaId}`);
    recommendations.push(`   Update your .env: GUPSHUP_APP_ID=${wabaFromPhone.wabaId}`);
  }

  if (debugInfo.errors.length > 0) {
    recommendations.push('⚠️  Some API calls failed. Check the errors array for details.');
  }

  return recommendations;
}

// ==========================================
// COMMERCE SETTINGS CONTROLLER FUNCTIONS
// ==========================================

// Get Commerce Settings for current workspace
async function getCommerceSettings(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check plan permissions
    const PLAN_FEATURES = {
      free: { commerce: false },
      basic: { commerce: false },
      premium: { commerce: true },
      enterprise: { commerce: true }
    };

    const canAccessCommerce = PLAN_FEATURES[workspace.plan]?.commerce;

    if (!canAccessCommerce) {
      return res.status(403).json({
        message: 'Commerce features are not available on your plan',
        currentPlan: workspace.plan,
        upgradeTo: 'premium'
      });
    }

    const CommerceSettings = require('../models/CommerceSettings');
    let settings = await CommerceSettings.findOne({ workspaceId: req.user.workspace });

    // If no settings exist, create default ones
    if (!settings) {
      settings = new CommerceSettings({
        workspaceId: req.user.workspace,
        enabled: false,
        currency: 'INR',
        taxPercentage: 0
      });
      await settings.save();
    }

    res.json({
      success: true,
      settings: {
        enabled: settings.enabled,
        currency: settings.currency,
        taxPercentage: settings.taxPercentage,
        paymentMethods: {
          cashOnDelivery: settings.paymentMethods.cashOnDelivery,
          razorpay: {
            enabled: settings.paymentMethods.razorpay.enabled,
            configured: !!settings.paymentMethods.razorpay.keyId
          },
          stripe: {
            enabled: settings.paymentMethods.stripe.enabled,
            configured: !!settings.paymentMethods.stripe.publicKey
          },
          paypal: {
            enabled: settings.paymentMethods.paypal.enabled,
            configured: !!settings.paymentMethods.paypal.clientId
          }
        },
        orderAutoConfirm: settings.orderAutoConfirm,
        notifications: settings.notifications,
        shipping: settings.shipping,
        business: settings.business,
        webhookUrl: settings.webhookUrl,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

// Update Commerce Settings for current workspace
async function updateCommerceSettings(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check plan permissions
    const PLAN_FEATURES = {
      free: { commerce: false },
      basic: { commerce: false },
      premium: { commerce: true },
      enterprise: { commerce: true }
    };

    const canAccessCommerce = PLAN_FEATURES[workspace.plan]?.commerce;

    if (!canAccessCommerce) {
      return res.status(403).json({
        message: 'Commerce features are not available on your plan',
        currentPlan: workspace.plan,
        upgradeTo: 'premium'
      });
    }

    // Only owner/admin can update commerce settings
    if (String(workspace.owner) !== String(req.user._id) && !['owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only workspace owner can update commerce settings' });
    }

    const CommerceSettings = require('../models/CommerceSettings');
    let settings = await CommerceSettings.findOne({ workspaceId: req.user.workspace });

    // Create if doesn't exist
    if (!settings) {
      settings = new CommerceSettings({
        workspaceId: req.user.workspace
      });
    }

    const {
      enabled,
      currency,
      taxPercentage,
      paymentMethods,
      orderAutoConfirm,
      notifications,
      shipping,
      business,
      webhookUrl
    } = req.body;

    // Validate and update fields
    if (enabled !== undefined) {
      settings.enabled = enabled;
    }

    if (currency !== undefined) {
      if (!['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'].includes(currency)) {
        return res.status(400).json({ message: 'Invalid currency code' });
      }
      settings.currency = currency;
    }

    if (taxPercentage !== undefined) {
      if (taxPercentage < 0 || taxPercentage > 100) {
        return res.status(400).json({ message: 'Tax percentage must be between 0 and 100' });
      }
      settings.taxPercentage = taxPercentage;
    }

    if (paymentMethods !== undefined) {
      // Update payment methods with validation
      if (paymentMethods.cashOnDelivery !== undefined) {
        settings.paymentMethods.cashOnDelivery = paymentMethods.cashOnDelivery;
      }

      if (paymentMethods.razorpay !== undefined) {
        if (paymentMethods.razorpay.enabled && (!paymentMethods.razorpay.keyId || !paymentMethods.razorpay.keySecret)) {
          return res.status(400).json({
            message: 'Razorpay credentials required to enable',
            required: ['keyId', 'keySecret']
          });
        }
        settings.paymentMethods.razorpay = paymentMethods.razorpay;
      }

      if (paymentMethods.stripe !== undefined) {
        if (paymentMethods.stripe.enabled && (!paymentMethods.stripe.publicKey || !paymentMethods.stripe.secretKey)) {
          return res.status(400).json({
            message: 'Stripe credentials required to enable',
            required: ['publicKey', 'secretKey']
          });
        }
        settings.paymentMethods.stripe = paymentMethods.stripe;
      }

      if (paymentMethods.paypal !== undefined) {
        if (paymentMethods.paypal.enabled && (!paymentMethods.paypal.clientId || !paymentMethods.paypal.clientSecret)) {
          return res.status(400).json({
            message: 'PayPal credentials required to enable',
            required: ['clientId', 'clientSecret']
          });
        }
        settings.paymentMethods.paypal = paymentMethods.paypal;
      }
    }

    if (orderAutoConfirm !== undefined) {
      settings.orderAutoConfirm = orderAutoConfirm;
    }

    if (notifications !== undefined) {
      settings.notifications = {
        ...settings.notifications,
        ...notifications
      };
    }

    if (shipping !== undefined) {
      settings.shipping = {
        ...settings.shipping,
        ...shipping
      };
    }

    if (business !== undefined) {
      settings.business = {
        ...settings.business,
        ...business
      };
    }

    if (webhookUrl !== undefined) {
      // Basic URL validation
      try {
        new URL(webhookUrl);
        settings.webhookUrl = webhookUrl;
      } catch {
        return res.status(400).json({ message: 'Invalid webhook URL' });
      }
    }

    settings.lastModifiedBy = req.user._id;
    await settings.save();

    res.json({
      success: true,
      message: 'Commerce settings updated successfully',
      settings: {
        enabled: settings.enabled,
        currency: settings.currency,
        taxPercentage: settings.taxPercentage,
        orderAutoConfirm: settings.orderAutoConfirm,
        notifications: settings.notifications,
        shipping: settings.shipping,
        business: settings.business,
        webhookUrl: settings.webhookUrl,
        updatedAt: settings.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

// Validate Commerce Configuration
async function validateCommerceConfig(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const CommerceSettings = require('../models/CommerceSettings');
    const settings = await CommerceSettings.findOne({ workspaceId: req.user.workspace });

    if (!settings) {
      return res.status(404).json({ message: 'Commerce settings not found' });
    }

    const validation = {
      isEnabled: settings.enabled,
      hasValidCurrency: !!settings.currency,
      hasTaxConfigured: settings.taxPercentage > 0,
      paymentMethods: {
        cashOnDelivery: settings.paymentMethods.cashOnDelivery.enabled,
        razorpayConfigured: settings.paymentMethods.razorpay.enabled && !!settings.paymentMethods.razorpay.keyId,
        stripeConfigured: settings.paymentMethods.stripe.enabled && !!settings.paymentMethods.stripe.publicKey,
        paypalConfigured: settings.paymentMethods.paypal.enabled && !!settings.paymentMethods.paypal.clientId
      },
      hasAtLeastOnePaymentMethod: [
        settings.paymentMethods.cashOnDelivery.enabled,
        !!(settings.paymentMethods.razorpay.enabled && settings.paymentMethods.razorpay.keyId),
        !!(settings.paymentMethods.stripe.enabled && settings.paymentMethods.stripe.publicKey),
        !!(settings.paymentMethods.paypal.enabled && settings.paymentMethods.paypal.clientId)
      ].some(m => m),
      shippingConfigured: settings.shipping.enabled,
      hasNotificationEmails: settings.notifications.adminEmails.length > 0,
      issues: []
    };

    // Check for issues
    if (!validation.isEnabled) {
      validation.issues.push('Commerce feature is disabled');
    }
    if (!validation.hasAtLeastOnePaymentMethod) {
      validation.issues.push('At least one payment method must be configured');
    }
    if (!validation.hasNotificationEmails && (settings.notifications.notifyAdminOnOrder || settings.notifications.notifyAdminOnPayment)) {
      validation.issues.push('Admin notification emails not configured');
    }

    res.json({
      success: true,
      validation
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// INBOX & ASSIGNMENT SETTINGS
// ==========================================

/**
 * Get Inbox Settings for current workspace
 */
async function getInboxSettings(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace)
      .select('inboxSettings')
      .lean();

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    res.json({
      success: true,
      settings: workspace.inboxSettings || {
        autoAssignmentEnabled: false,
        assignmentStrategy: 'MANUAL',
        slaEnabled: false,
        slaFirstResponseMinutes: 60,
        slaResolutionMinutes: 1440,
        agentRateLimitEnabled: true,
        agentMessagesPerMinute: 30,
        softLockEnabled: true,
        softLockTimeoutSeconds: 60
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update Inbox Settings for current workspace
 */
async function updateInboxSettings(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Only owner/admin can update inbox settings
    if (String(workspace.owner) !== String(req.user._id) && !['owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only workspace owner or admin can update inbox settings' });
    }

    const {
      autoAssignmentEnabled,
      assignmentStrategy,
      slaEnabled,
      slaFirstResponseMinutes,
      slaResolutionMinutes,
      agentRateLimitEnabled,
      agentMessagesPerMinute,
      softLockEnabled,
      softLockTimeoutSeconds
    } = req.body;

    // Initialize if missing
    if (!workspace.inboxSettings) {
      workspace.inboxSettings = {};
    }

    // Update fields
    if (autoAssignmentEnabled !== undefined) workspace.inboxSettings.autoAssignmentEnabled = autoAssignmentEnabled;
    if (assignmentStrategy !== undefined) workspace.inboxSettings.assignmentStrategy = assignmentStrategy;
    if (slaEnabled !== undefined) workspace.inboxSettings.slaEnabled = slaEnabled;
    if (slaFirstResponseMinutes !== undefined) workspace.inboxSettings.slaFirstResponseMinutes = slaFirstResponseMinutes;
    if (slaResolutionMinutes !== undefined) workspace.inboxSettings.slaResolutionMinutes = slaResolutionMinutes;
    if (agentRateLimitEnabled !== undefined) workspace.inboxSettings.agentRateLimitEnabled = agentRateLimitEnabled;
    if (agentMessagesPerMinute !== undefined) workspace.inboxSettings.agentMessagesPerMinute = agentMessagesPerMinute;
    if (softLockEnabled !== undefined) workspace.inboxSettings.softLockEnabled = softLockEnabled;
    if (softLockTimeoutSeconds !== undefined) workspace.inboxSettings.softLockTimeoutSeconds = softLockTimeoutSeconds;

    await workspace.save();

    res.json({
      success: true,
      message: 'Inbox settings updated successfully',
      settings: workspace.inboxSettings
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWhatsAppNumberStatus,
  getWABASettings,
  updateWABASettings,
  createWABASettings,
  testWABAConnection,
  initializeWABAFromEnv,
  debugMetaCredentials,
  getCommerceSettings,
  updateCommerceSettings,
  validateCommerceConfig,
  getInboxSettings,
  updateInboxSettings
};
