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

module.exports = {
  getWhatsAppNumberStatus,
  getWABASettings,
  updateWABASettings,
  createWABASettings,
  testWABAConnection,
  initializeWABAFromEnv,
  debugMetaCredentials
};
