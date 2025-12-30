const Workspace = require('../models/Workspace');

// Initialize WABA settings from environment variables (for development)
async function initializeWABAFromEnv(req, res, next) {
  try {
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
    const accessToken = process.env.META_ACCESS_TOKEN;
    const wabaId = process.env.META_WABA_ID;
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    const verifyToken = process.env.META_VERIFY_TOKEN;
    const appSecret = process.env.META_APP_SECRET;
    
    if (!accessToken || !wabaId || !phoneNumberId) {
      return res.status(400).json({ 
        message: 'Missing required environment variables',
        required: ['META_ACCESS_TOKEN', 'META_WABA_ID', 'META_PHONE_NUMBER_ID'],
        hint: 'Set these in your .env file'
      });
    }
    
    // Update workspace
    workspace.whatsappAccessToken = accessToken;
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
      whatsappPhoneNumberId: workspace.whatsappPhoneNumberId || null,
      whatsappVerifyToken: workspace.whatsappVerifyToken || null,
      wabaId: workspace.wabaId || null,
      businessAccountId: workspace.businessAccountId || null,
      connectedAt: workspace.connectedAt || null,
      hasToken: !!workspace.whatsappAccessToken,
      maskedToken
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
    
    // Only owner can update WABA settings
    if (String(workspace.owner) !== String(req.user._id) && req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only workspace owner can update WABA settings' });
    }
    
    const {
      whatsappAccessToken,
      whatsappPhoneNumberId,
      whatsappVerifyToken,
      wabaId,
      businessAccountId
    } = req.body;
    
    // Update fields if provided
    if (whatsappAccessToken !== undefined) {
      workspace.whatsappAccessToken = whatsappAccessToken;
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
    const metaService = require('../services/metaService');
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
    const workspace = await Workspace.findById(req.user.workspace);
    
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const accessToken = workspace.whatsappAccessToken || process.env.META_ACCESS_TOKEN;
    const phoneNumberId = workspace.whatsappPhoneNumberId || process.env.META_PHONE_NUMBER_ID;
    
    if (!accessToken) {
      return res.status(400).json({ 
        message: 'No access token configured',
        hint: 'Set META_ACCESS_TOKEN in .env or configure in settings'
      });
    }

    const metaService = require('../services/metaService');
    
    // Get debug info
    const debugInfo = await metaService.debugTokenInfo(accessToken);
    
    // Try to get WABA from phone number if available
    let wabaFromPhone = null;
    if (phoneNumberId) {
      try {
        wabaFromPhone = await metaService.getWABAFromPhoneNumber(accessToken, phoneNumberId);
      } catch (e) {
        wabaFromPhone = { error: e.message };
      }
    }

    res.json({
      success: true,
      currentConfig: {
        phoneNumberId: phoneNumberId || 'Not configured',
        wabaId: workspace.wabaId || process.env.META_WABA_ID || 'Not configured',
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
    recommendations.push(`✅ Found ${debugInfo.wabaAccounts.length} WABA account(s). Use one of these IDs as META_WABA_ID:`);
    debugInfo.wabaAccounts.forEach(waba => {
      recommendations.push(`   - WABA ID: ${waba.id} (${waba.name})`);
    });
  }
  
  if (wabaFromPhone?.wabaId) {
    recommendations.push(`✅ Found WABA ID from phone number: ${wabaFromPhone.wabaId}`);
    recommendations.push(`   Update your .env: META_WABA_ID=${wabaFromPhone.wabaId}`);
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

    // Only owner can update commerce settings
    if (String(workspace.owner) !== String(req.user._id) && req.user.role !== 'owner') {
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
  validateCommerceConfig
};
