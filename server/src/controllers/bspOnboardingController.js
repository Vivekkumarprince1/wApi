/**
 * =============================================================================
 * BSP ONBOARDING CONTROLLER - INTERAKT PARENTAL MODEL (HARDENED)
 * =============================================================================
 * 
 * Handles all BSP onboarding endpoints:
 * - POST /start - Generate Gupshup embed URL
 * - GET /callback - Callback redirect from Gupshup embed flow
 * - POST /complete - Complete onboarding and create/update workspace
 * - GET /status - Get onboarding status
 * - POST /disconnect - Disconnect WhatsApp
 * - GET /stage1-status - Get Stage 1 completion status
 * 
 * HARDENED:
 * - Uses V2 onboarding service with full validation
 * - Tokens encrypted at rest
 * - Parent WABA ownership validation
 * - Phone status tracking
 */

const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { logger } = require('../utils/logger');
const { log: auditLog } = require('../services/auditService');
const { getStage1Status } = require('../middlewares/phoneActivation');
const { getRedis, setJson, getJson, deleteKey } = require('../config/redis');
const crypto = require('crypto');
const { provisionPartnerApp } = require('../services/gupshupProvisioningService');
const {
  getBspConfig,
  generateBspSignupUrl,
  completeBspOnboarding,
  registerPhoneForWorkspace
} = require('../services/bspOnboardingServiceV2'); // Use V2 hardened service

// Embed state must survive restarts and multi-instance routing
const ESB_STATE_TTL_SECONDS = 35 * 60; // 35 minutes

function getRedisClient() {
  return getRedis();
}

async function setEsbState(state, data) {
  const redis = getRedisClient();
  await setJson(`esb:state:${state}`, data, ESB_STATE_TTL_SECONDS);
  return redis;
}

async function getEsbState(state) {
  getRedisClient();
  return getJson(`esb:state:${state}`);
}

async function deleteEsbState(state) {
  getRedisClient();
  return deleteKey(`esb:state:${state}`);
}

// =============================================================================
// START BSP ONBOARDING
// =============================================================================

/**
 * Start BSP onboarding flow
 * Generates Gupshup embed URL and stores state
 * 
 * POST /api/v1/onboarding/bsp/start
 */
async function startBspOnboarding(req, res) {
  try {
    const userId = req.user._id.toString();

    // Check if user already has connected workspace
    const user = await User.findById(userId).populate('workspace');

    if (user?.workspace?.whatsappConnected) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp already connected',
        code: 'ALREADY_CONNECTED',
        workspace: {
          id: user.workspace._id,
          phoneNumber: user.workspace.whatsappPhoneNumber,
          wabaId: user.workspace.wabaId
        }
      });
    }

    const state = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const backendUrl = process.env.API_URL || 'http://localhost:5001/api/v1';
    const callbackUrl = `${backendUrl}/onboarding/bsp/callback?state=${state}`;

    // Orchestrate Gupshup Setup (App Creation, Contact, DB Update, Subscriptions, Embed Link)
    const result = await provisionPartnerApp(userId, {
      businessName: req.body.businessName,
      phone: req.body.phone,
      callbackUrl: callbackUrl,
      connectionType: req.body.connectionType || 'business_app',
      region: req.body.region
    });

    // Store state for callback verification (Redis-backed)
    await setEsbState(state, {
      userId,
      workspaceId: result.workspaceId || user?.workspace?._id?.toString(),
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt
    });

    logger.info(`[BSP] Onboarding started for user ${userId}`);

    // Audit log (positional args: workspaceId, userId, action, resource, details)
    await auditLog(
      result.workspaceId || user?.workspace?._id?.toString() || null,
      userId,
      'bsp_onboarding_started',
      'onboarding',
      { appId: result.appId }
    );

    res.json({
      success: true,
      url: result.url,
      state: state,
      expiresAt: expiresAt
    });
  } catch (error) {
    logger.error('[BSP] Start onboarding error:', error.message);
    if (error.response) {
      logger.error('[BSP] Response status:', error.response.status);
      logger.error('[BSP] Response data:', error.response.data);
    }

    const isConfigError = error.message.includes('configuration');
    res.status(isConfigError ? 503 : 400).json({
      success: false,
      message: error.message,
      code: isConfigError ? 'BSP_NOT_CONFIGURED' : 'START_FAILED'
    });
  }
}

function normalizeRegion(value) {
  return String(value || process.env.GUPSHUP_DEFAULT_REGION || 'IN').trim().toUpperCase();
}

function extractProviderMessage(error) {
  const providerData = error?.response?.data;
  if (!providerData) return null;
  if (typeof providerData === 'string') return providerData;
  return providerData.message || providerData.data || providerData.error || null;
}

async function registerPhoneForAppEndpoint(req, res) {
  try {
    const userId = req.user._id.toString();
    const connectionType = req.body?.connectionType || 'new_number';

    if (!['business_app', 'new_number'].includes(connectionType)) {
      return res.status(400).json({
        success: false,
        message: 'connectionType must be one of: business_app, new_number',
        code: 'INVALID_CONNECTION_TYPE'
      });
    }

    if (connectionType === 'business_app') {
      const result = await generateBspSignupUrl(userId, {
        businessName: req.body?.businessName,
        phone: req.body?.phone,
        contactEmail: req.body?.contactEmail
      });

      return res.json({
        success: true,
        connectionType,
        message: 'Business app connect flow started',
        url: result.url,
        state: result.state,
        expiresAt: result.expiresAt,
        appId: result.appId
      });
    }

    const region = normalizeRegion(req.body?.region);
    const appId = req.body?.appId ? String(req.body.appId).trim() : undefined;

    const result = await registerPhoneForWorkspace(userId, { region, appId });

    return res.json({
      success: true,
      connectionType,
      message: 'New number registration started',
      appId: result.appId,
      region: result.region,
      providerResponse: result.providerResponse
    });
  } catch (error) {
    const providerStatus = Number(error?.response?.status || 0);
    const providerMessage = extractProviderMessage(error);

    if (providerStatus === 429) {
      return res.status(429).json({
        success: false,
        message: providerMessage || 'Rate limit hit while registering phone. Please retry shortly.',
        code: 'PROVIDER_RATE_LIMIT'
      });
    }

    if (providerStatus === 400) {
      return res.status(400).json({
        success: false,
        message: providerMessage || error.message || 'Invalid register phone request',
        code: 'REGISTER_PHONE_BAD_REQUEST'
      });
    }

    if (providerStatus === 401 || providerStatus === 403) {
      return res.status(502).json({
        success: false,
        message: providerMessage || 'Provider authentication failed while registering phone',
        code: 'PROVIDER_AUTH_FAILED'
      });
    }

    logger.error('[BSP] Register phone error:', error.message);
    return res.status(500).json({
      success: false,
      message: providerMessage || error.message || 'Failed to register phone for app',
      code: 'REGISTER_PHONE_FAILED'
    });
  }
}

// =============================================================================
// OAUTH CALLBACK
// =============================================================================

/**
 * Handle callback from Gupshup onboarding embed
 * Redirects to frontend with code/state
 * 
 * GET /api/v1/onboarding/bsp/callback
 */
async function handleCallback(req, res) {
  const { code, state, appId, error, error_description } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // Handle errors from provider
  if (error) {
    logger.error('[BSP] Callback error from Gupshup:', error, error_description);
    return res.redirect(
      `${frontendUrl}/onboarding/esb/callback?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || 'Signup cancelled')}`
    );
  }

  // Validate state exists
  if (!state || !(await getEsbState(state))) {
    logger.error('[BSP] Invalid or expired state:', state);
    return res.redirect(
      `${frontendUrl}/onboarding/esb/callback?error=invalid_state&message=${encodeURIComponent('Session expired. Please try again.')}`
    );
  }

  // Accept either appId or code from callback
  const callbackToken = appId || code;
  if (!callbackToken) {
    logger.error('[BSP] No appId/code in callback');
    return res.redirect(
      `${frontendUrl}/onboarding/esb/callback?error=no_app&message=${encodeURIComponent('No onboarding app identifier received.')}`
    );
  }

  // Redirect to frontend, which calls /complete to persist workspace mapping
  logger.info('[BSP] Callback received, redirecting to frontend');

  res.redirect(
    `${frontendUrl}/onboarding/esb/callback?code=${encodeURIComponent(callbackToken)}&state=${encodeURIComponent(state)}`
  );
}

// =============================================================================
// COMPLETE ONBOARDING
// =============================================================================

/**
 * Complete BSP onboarding
 * Exchanges code, fetches WABA/phone, creates workspace
 * 
 * POST /api/v1/onboarding/bsp/complete
 */
async function completeOnboarding(req, res) {
  try {
    const { code, state } = req.body;
    const userId = req.user._id.toString();

    // Validate inputs
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing code or state',
        code: 'INVALID_REQUEST'
      });
    }

    // Validate state
    const stateData = await getEsbState(state);
    if (!stateData) {
      return res.status(400).json({
        success: false,
        message: 'Session expired. Please start again.',
        code: 'STATE_EXPIRED'
      });
    }

    // Verify user matches
    if (stateData.userId !== userId) {
      logger.error('[BSP] User mismatch:', { expected: stateData.userId, got: userId });
      return res.status(403).json({
        success: false,
        message: 'Session user mismatch',
        code: 'USER_MISMATCH'
      });
    }

    // Check state expiry
    if (new Date() > new Date(stateData.expiresAt)) {
      await deleteEsbState(state);
      return res.status(400).json({
        success: false,
        message: 'Session expired. Please start again.',
        code: 'STATE_EXPIRED'
      });
    }

    // Complete BSP onboarding using Gupshup partner app resolution
    const workspaceId = stateData.workspaceId || 'new-workspace';
    const result = await completeBspOnboarding(code, workspaceId);

    // Validate onboarding completion
    if (!result.onboardingComplete) {
      throw new Error('Onboarding validation failed: Stage 1 incomplete');
    }

    // Create or update workspace
    let workspace;

    const updateData = {
      // Business identifiers
      businessId: result.businessId,
      wabaId: result.wabaId,

      // Phone details
      whatsappPhoneNumber: result.displayPhoneNumber,
      bspDisplayPhoneNumber: result.displayPhoneNumber,
      verifiedName: result.verifiedName,
      bspVerifiedName: result.verifiedName,

      // Phone status (CRITICAL for Stage 1)
      bspPhoneStatus: result.phoneStatus,

      // Status
      whatsappConnected: result.phoneStatus === 'CONNECTED',
      connectedAt: result.connectedAt,

      // Phone metadata
      qualityRating: result.qualityRating,
      bspQualityRating: result.qualityRating,
      messagingLimitTier: result.messagingLimit,
      bspMessagingTier: result.messagingLimit,
      codeVerificationStatus: result.codeVerificationStatus,
      nameStatus: result.nameStatus,
      isOfficialAccount: result.isOfficialAccount,

      // Token is stored in vault only (no workspace token storage)
      tokenExpiresAt: result.tokenExpiresAt,

      // BSP context
      bspManaged: true,
      bspWabaId: result.bspWabaId,
      gupshupAppId: result.gupshupAppId,
      onboardingStatus: result.onboardingStatus,
      phoneStatus: result.phoneStatus,
      bspOnboardedAt: new Date(),

      // Business profile
      businessProfile: result.businessProfile,

      // All phones
      phoneNumbers: result.allPhones,

      // ESB flow tracking
      'esbFlow.status': result.phoneStatus === 'CONNECTED' ? 'completed' : 'phone_pending',
      'esbFlow.completedAt': result.phoneStatus === 'CONNECTED' ? new Date() : null,

      // Onboarding progress
      'onboarding.wabaConnectionCompleted': true,
      'onboarding.wabaConnectionCompletedAt': new Date()
    };

    const unsetData = {};

    if (result.phoneNumberId) {
      updateData.phoneNumberId = result.phoneNumberId;
      updateData.bspPhoneNumberId = result.phoneNumberId;
      updateData.whatsappPhoneNumberId = result.phoneNumberId;
    } else {
      unsetData.phoneNumberId = 1;
      unsetData.bspPhoneNumberId = 1;
      unsetData.whatsappPhoneNumberId = 1;
    }

    if (stateData.workspaceId) {
      // Update existing workspace
      workspace = await Workspace.findByIdAndUpdate(
        stateData.workspaceId,
        {
          $set: updateData,
          ...(Object.keys(unsetData).length > 0 ? { $unset: unsetData } : {})
        },
        { new: true }
      );
    } else {
      // Create new workspace
      workspace = await Workspace.create({
        name: result.verifiedName || result.displayPhoneNumber || 'New Workspace',
        owner: userId,
        ...updateData
      });

      // Link workspace to user
      await User.findByIdAndUpdate(userId, { workspace: workspace._id });
    }

    // Clean up state
    await deleteEsbState(state);

    // Audit log
    await auditLog(
      workspace._id.toString(),
      userId,
      'bsp_onboarding_completed',
      'workspace',
      {
        appId: result.gupshupAppId,
        phoneNumberId: result.phoneNumberId,
        displayPhoneNumber: result.displayPhoneNumber
      }
    );

    logger.info(`[BSP] Onboarding completed for user ${userId}:`, {
      workspaceId: workspace._id,
      phone: result.displayPhoneNumber
    });

    res.json({
      success: true,
      message: result.phoneStatus === 'CONNECTED'
        ? 'WhatsApp connected successfully'
        : 'WhatsApp setup in progress - phone activation pending',
      workspace: {
        id: workspace._id,
        name: workspace.name,
        gupshupAppId: workspace.gupshupAppId,
        phoneNumberId: workspace.phoneNumberId,
        phoneNumber: workspace.whatsappPhoneNumber,
        verifiedName: workspace.verifiedName,
        qualityRating: workspace.qualityRating,
        messagingLimit: workspace.messagingLimitTier,
        connectedAt: workspace.connectedAt,
        phoneStatus: result.phoneStatus
      },
      stage1: {
        complete: result.phoneStatus === 'CONNECTED',
        appIdFetched: !!result.gupshupAppId,
        phoneNumberIdFetched: !!result.phoneNumberId,
        phoneStatus: result.phoneStatus,
        onboardingProgress: result.onboardingProgress
      }
    });
  } catch (error) {
    logger.error('[BSP] Complete onboarding error:', error.message);

    // Include progress info in error response
    const errorResponse = {
      success: false,
      message: error.message,
      code: 'COMPLETE_FAILED'
    };

    if (error.onboardingProgress) {
      errorResponse.onboardingProgress = error.onboardingProgress;
    }

    res.status(400).json(errorResponse);
  }
}

// =============================================================================
// GET STATUS
// =============================================================================

/**
 * Get BSP onboarding status
 * 
 * GET /api/v1/onboarding/bsp/status
 */
async function getStatus(req, res) {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate('workspace');

    if (!user?.workspace) {
      return res.json({
        success: true,
        connected: false,
        status: 'not_started',
        message: 'No workspace found'
      });
    }

    const ws = user.workspace;

    res.json({
      success: true,
      connected: ws.whatsappConnected || false,
      status: ws.onboardingStatus || ws.esbFlow?.status || 'not_started',
      workspace: ws.whatsappConnected ? {
        id: ws._id,
        name: ws.name,
        gupshupAppId: ws.gupshupAppId,
        phoneNumberId: ws.phoneNumberId,
        phoneNumber: ws.whatsappPhoneNumber,
        verifiedName: ws.verifiedName,
        qualityRating: ws.qualityRating,
        messagingLimit: ws.messagingLimitTier,
        nameStatus: ws.nameStatus,
        isOfficialAccount: ws.isOfficialAccount,
        connectedAt: ws.connectedAt,
        bspManaged: ws.bspManaged
      } : null
    });
  } catch (error) {
    logger.error('[BSP] Get status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get status'
    });
  }
}

// =============================================================================
// DISCONNECT
// =============================================================================

/**
 * Disconnect WhatsApp from workspace
 * 
 * POST /api/v1/onboarding/bsp/disconnect
 */
async function disconnect(req, res) {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate('workspace');

    if (!user?.workspace?.whatsappConnected && !user?.workspace?.gupshupAppId) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not connected',
        code: 'NOT_CONNECTED'
      });
    }

    const ws = user.workspace;
    const workspaceId = ws._id;

    // Try to stop the Gupshup app
    if (ws.gupshupAppId) {
      try {
        const gupshupService = require('../services/gupshupService');
        await gupshupService.stopApp(ws.gupshupAppId);
        logger.info(`[BSP] Stopped Gupshup app ${ws.gupshupAppId}`);
      } catch (stopErr) {
        logger.warn(`[BSP] Failed to stop Gupshup app ${ws.gupshupAppId}:`, stopErr.message);
        // Continue with local disconnect anyway
      }
    }

    // Clear ALL WhatsApp connection data
    await Workspace.findByIdAndUpdate(workspaceId, {
      $set: {
        whatsappConnected: false,
        accessToken: null,
        tokenExpiresAt: null,
        'esbFlow.status': 'disconnected',
        'esbFlow.disconnectedAt': new Date(),
        bspPhoneStatus: 'DISCONNECTED',
        onboardingStatus: 'disconnected',
        isOfficialAccount: false,
        gupshupAppLive: false,
        gupshupAppHealth: null,
        bspManaged: false,
        bspSyncStatus: 'INACTIVE'
      },
      $unset: {
        gupshupAppId: '',
        gupshupAppName: '',
        wabaId: '',
        wabaName: '',
        phoneNumberId: '',
        bspPhoneNumberId: '',
        whatsappPhoneNumber: '',
        whatsappPhoneNumberId: '',
        activePhoneNumberId: '',
        verifiedName: '',
        qualityRating: '',
        bspQualityRating: '',
        messagingLimitTier: '',
        bspMessagingTier: '',
        phoneNumbers: '',
        connectedAt: '',
        bspOnboardedAt: '',
        'gupshupIdentity.partnerAppId': '',
        'gupshupIdentity.appApiKey': ''
      }
    });

    // Audit log
    await auditLog(
      workspaceId.toString(),
      userId.toString(),
      'bsp_disconnected',
      'workspace',
      { phoneNumber: ws.whatsappPhoneNumber || ws.phoneNumbers?.[0]?.displayPhoneNumber }
    );

    logger.info(`[BSP] Fully disconnected and deregistered workspace ${workspaceId}`);

    res.json({
      success: true,
      message: 'WhatsApp number deregistered successfully. You can now connect a new number.'
    });
  } catch (error) {
    logger.error('[BSP] Disconnect error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect'
    });
  }
}

// =============================================================================
// GET BSP CONFIG (for frontend)
// =============================================================================

/**
 * Get BSP configuration for frontend
 * 
 * GET /api/v1/onboarding/bsp/config
 */
async function getConfig(req, res) {
  try {
    const bsp = getBspConfig();

    res.json({
      success: true,
      config: {
        appId: bsp.gupshup.appId,
        provider: bsp.provider,
        // Don't expose secrets!
        configured: true
      }
    });
  } catch (error) {
    // Config incomplete
    res.json({
      success: true,
      config: {
        configured: false,
        message: error.message
      }
    });
  }
}

// =============================================================================
// GET STAGE 1 STATUS
// =============================================================================

/**
 * Get Stage 1 completion status
 * Used by client to determine if messaging/templates/campaigns are allowed
 * 
 * GET /api/v1/onboarding/bsp/stage1-status
 */
async function getStage1StatusEndpoint(req, res) {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate('workspace');

    if (!user?.workspace) {
      return res.json({
        success: true,
        stage1: {
          complete: false,
          error: 'No workspace found',
          checklist: {
            businessIdFetched: false,
            wabaIdFetched: false,
            phoneNumberIdFetched: false,
            phoneConnected: false,
            webhooksSubscribed: false
          },
          blockedFeatures: [
            'template_submission',
            'message_sending',
            'campaign_creation',
            'bulk_messaging'
          ]
        }
      });
    }

    const status = await getStage1Status(user.workspace._id);

    res.json({
      success: true,
      stage1: status
    });
  } catch (error) {
    logger.error('[BSP] Get Stage 1 status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get Stage 1 status',
      code: 'STAGE1_STATUS_ERROR'
    });
  }
}

// =============================================================================
// TRIGGER MANUAL SYNC
// =============================================================================

/**
 * Trigger manual WABA sync for a workspace
 * Useful when phone activation is pending
 * 
 * POST /api/v1/onboarding/bsp/sync
 */
async function triggerSync(req, res) {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate('workspace');

    if (!user?.workspace) {
      return res.status(404).json({
        success: false,
        message: 'No workspace found',
        code: 'NO_WORKSPACE'
      });
    }

    const { triggerWorkspaceSync } = require('../services/gupshupAppSyncService');

    const result = await triggerWorkspaceSync(user.workspace._id);

    // After sync, ensure wabaId is set if the app has one
    const updatedWorkspace = await Workspace.findById(user.workspace._id);
    if (updatedWorkspace && updatedWorkspace.whatsappConnected && !updatedWorkspace.wabaId) {
      // Use gupshupAppId as wabaId (Gupshup's Partner API model)
      if (updatedWorkspace.gupshupAppId || updatedWorkspace.gupshupIdentity?.partnerAppId) {
        const appId = updatedWorkspace.gupshupAppId || updatedWorkspace.gupshupIdentity?.partnerAppId;
        await Workspace.findByIdAndUpdate(updatedWorkspace._id, {
          $set: {
            wabaId: appId,
            bspWabaId: appId
          }
        });
      }
    }

    // Get updated stage 1 status
    const stage1Status = await getStage1Status(user.workspace._id);

    res.json({
      success: true,
      message: 'Sync triggered',
      connected: stage1Status.complete,
      syncResult: result,
      stage1: stage1Status
    });
  } catch (error) {
    logger.error('[BSP] Manual sync error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger sync',
      code: 'SYNC_ERROR'
    });
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  startBspOnboarding,
  registerPhoneForAppEndpoint,
  handleCallback,
  completeOnboarding,
  getStatus,
  disconnect,
  getConfig,
  getStage1StatusEndpoint,
  triggerSync
};
