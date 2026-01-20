/**
 * =============================================================================
 * BSP ONBOARDING CONTROLLER - INTERAKT PARENTAL MODEL (HARDENED)
 * =============================================================================
 * 
 * Handles all BSP onboarding endpoints:
 * - POST /start - Generate ESB URL
 * - GET /callback - OAuth callback from Meta
 * - POST /complete - Process callback and create workspace
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
const { encryptToken, isEncrypted } = require('../utils/tokenEncryption');
const { getStage1Status } = require('../middlewares/phoneActivation');
const {
  getBspConfig,
  generateBspSignupUrl,
  completeBspOnboarding
} = require('../services/bspOnboardingServiceV2'); // Use V2 hardened service

// In-memory state store (use Redis in production)
const stateStore = new Map();

// =============================================================================
// START BSP ONBOARDING
// =============================================================================

/**
 * Start BSP onboarding flow
 * Generates ESB URL and stores state
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

    // Generate ESB URL
    const result = await generateBspSignupUrl(userId, {
      businessName: req.body.businessName,
      phone: req.body.phone
    });

    // Store state for callback verification
    stateStore.set(result.state, {
      userId,
      workspaceId: user?.workspace?._id?.toString(),
      createdAt: new Date(),
      expiresAt: new Date(result.expiresAt)
    });

    // Auto-cleanup expired states after 35 minutes
    setTimeout(() => {
      stateStore.delete(result.state);
    }, 35 * 60 * 1000);

    logger.info(`[BSP] Onboarding started for user ${userId}`);

    // Audit log (positional args: workspaceId, userId, action, resource, details)
    await auditLog(
      user?.workspace?._id?.toString() || null,
      userId,
      'bsp_onboarding_started',
      'onboarding',
      { configId: result.configId }
    );

    res.json({
      success: true,
      url: result.url,
      state: result.state,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    logger.error('[BSP] Start onboarding error:', error.message);
    
    const isConfigError = error.message.includes('configuration');
    res.status(isConfigError ? 503 : 400).json({
      success: false,
      message: error.message,
      code: isConfigError ? 'BSP_NOT_CONFIGURED' : 'START_FAILED'
    });
  }
}

// =============================================================================
// OAUTH CALLBACK
// =============================================================================

/**
 * Handle OAuth callback from Meta
 * Redirects to frontend with code/state
 * 
 * GET /api/v1/onboarding/bsp/callback
 */
async function handleCallback(req, res) {
  const { code, state, error, error_description } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // Handle errors from Meta
  if (error) {
    logger.error('[BSP] Callback error from Meta:', error, error_description);
    return res.redirect(
      `${frontendUrl}/onboarding/esb?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || 'Signup cancelled')}`
    );
  }

  // Validate state exists
  if (!state || !stateStore.has(state)) {
    logger.error('[BSP] Invalid or expired state:', state);
    return res.redirect(
      `${frontendUrl}/onboarding/esb?error=invalid_state&message=${encodeURIComponent('Session expired. Please try again.')}`
    );
  }

  // Validate code exists
  if (!code) {
    logger.error('[BSP] No code in callback');
    return res.redirect(
      `${frontendUrl}/onboarding/esb?error=no_code&message=${encodeURIComponent('No authorization code received.')}`
    );
  }

  // Redirect to frontend with code and state
  // Frontend will call /complete to finish onboarding
  logger.info('[BSP] Callback received, redirecting to frontend');
  
  res.redirect(
    `${frontendUrl}/onboarding/esb?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
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
    const stateData = stateStore.get(state);
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
      stateStore.delete(state);
      return res.status(400).json({
        success: false,
        message: 'Session expired. Please start again.',
        code: 'STATE_EXPIRED'
      });
    }

    // Complete BSP onboarding (exchange code, fetch WABA, etc)
    // Pass workspace ID for token encryption context
    const workspaceId = stateData.workspaceId || 'new-workspace';
    const result = await completeBspOnboarding(code, workspaceId);
    
    // Validate onboarding completion
    if (!result.onboardingComplete) {
      throw new Error('Onboarding validation failed: Stage 1 incomplete');
    }

    // Create or update workspace
    let workspace;
    
    if (stateData.workspaceId) {
      // Update existing workspace
      workspace = await Workspace.findByIdAndUpdate(
        stateData.workspaceId,
        {
          // Business identifiers
          businessId: result.businessId,
          wabaId: result.wabaId,
          
          // Phone details
          phoneNumberId: result.phoneNumberId,
          bspPhoneNumberId: result.phoneNumberId,
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
          
          // Token (ENCRYPTED)
          accessToken: result.accessToken, // Already encrypted by V2 service
          tokenExpiresAt: result.tokenExpiresAt,
          
          // BSP context
          bspManaged: true,
          bspWabaId: result.bspWabaId,
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
        },
        { new: true }
      );
    } else {
      // Create new workspace
      workspace = await Workspace.create({
        name: result.verifiedName || result.displayPhoneNumber,
        owner: userId,
        
        // Business identifiers
        businessId: result.businessId,
        wabaId: result.wabaId,
        
        // Phone details
        phoneNumberId: result.phoneNumberId,
        bspPhoneNumberId: result.phoneNumberId,
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
        
        // Token (ENCRYPTED)
        accessToken: result.accessToken, // Already encrypted by V2 service
        tokenExpiresAt: result.tokenExpiresAt,
        
        // BSP context
        bspManaged: true,
        bspWabaId: result.bspWabaId,
        bspOnboardedAt: new Date(),
        
        // Business profile
        businessProfile: result.businessProfile,
        
        // All phones
        phoneNumbers: result.allPhones,
        
        // ESB flow tracking
        esbFlow: {
          status: result.phoneStatus === 'CONNECTED' ? 'completed' : 'phone_pending',
          completedAt: result.phoneStatus === 'CONNECTED' ? new Date() : null
        },
        
        // Onboarding progress
        onboarding: {
          wabaConnectionCompleted: true,
          wabaConnectionCompletedAt: new Date()
        }
      });

      // Link workspace to user
      await User.findByIdAndUpdate(userId, { workspace: workspace._id });
    }

    // Clean up state
    stateStore.delete(state);

    // Audit log
    await auditLog(
      workspace._id.toString(),
      userId,
      'bsp_onboarding_completed',
      'workspace',
      {
        wabaId: result.wabaId,
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
        wabaId: workspace.wabaId,
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
        wabaIdFetched: !!result.wabaId,
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
      status: ws.esbFlow?.status || 'not_started',
      workspace: ws.whatsappConnected ? {
        id: ws._id,
        name: ws.name,
        wabaId: ws.wabaId,
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

    if (!user?.workspace?.whatsappConnected) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not connected',
        code: 'NOT_CONNECTED'
      });
    }

    const workspaceId = user.workspace._id;

    // Clear WhatsApp connection (keep workspace for data retention)
    await Workspace.findByIdAndUpdate(workspaceId, {
      whatsappConnected: false,
      accessToken: null,
      tokenExpiresAt: null,
      'esbFlow.status': 'disconnected',
      'esbFlow.disconnectedAt': new Date()
    });

    // Audit log
    await auditLog(
      workspaceId.toString(),
      userId.toString(),
      'bsp_disconnected',
      'workspace',
      { phoneNumber: user.workspace.whatsappPhoneNumber }
    );

    logger.info(`[BSP] Disconnected workspace ${workspaceId}`);

    res.json({
      success: true,
      message: 'WhatsApp disconnected'
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
        appId: bsp.appId,
        configId: bsp.configId,
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

    // Import sync service
    const { triggerWorkspaceSync } = require('../services/wabaAutosyncService');
    
    const result = await triggerWorkspaceSync(user.workspace._id);

    // Get updated stage 1 status
    const stage1Status = await getStage1Status(user.workspace._id);

    res.json({
      success: true,
      message: 'Sync triggered',
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
  handleCallback,
  completeOnboarding,
  getStatus,
  disconnect,
  getConfig,
  getStage1StatusEndpoint,
  triggerSync
};
