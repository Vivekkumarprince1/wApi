/**
 * =============================================================================
 * PHONE ACTIVATION CHECK MIDDLEWARE - INTERAKT BSP MODEL
 * =============================================================================
 * 
 * Blocks messaging/template/campaign features until phone is CONNECTED.
 * 
 * RULES:
 * 1. Phone must have status === 'CONNECTED'
 * 2. WABA must be valid and linked
 * 3. Phone number ID must exist
 * 
 * BLOCKED FEATURES UNTIL ACTIVATION:
 * - Template submission
 * - Message sending
 * - Campaign creation/execution
 * - Bulk messaging
 */

const Workspace = require('../models/Workspace');

// =============================================================================
// PHONE STATUS CONSTANTS
// =============================================================================

const PHONE_STATUS = {
  PENDING: 'PENDING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  BANNED: 'BANNED',
  FLAGGED: 'FLAGGED',
  RESTRICTED: 'RESTRICTED',
  RATE_LIMITED: 'RATE_LIMITED'
};

// =============================================================================
// TASK E: PHONE STATUS DEGRADATION MODE
// =============================================================================

// Statuses that allow full messaging
const FULL_ACCESS_STATUSES = [PHONE_STATUS.CONNECTED];

// Statuses that allow read-only access (can view but not send)
const READ_ONLY_STATUSES = [PHONE_STATUS.RESTRICTED, PHONE_STATUS.FLAGGED];

// Statuses that block all sending operations
const SEND_BLOCKED_STATUSES = [
  PHONE_STATUS.DISCONNECTED,
  PHONE_STATUS.BANNED,
  PHONE_STATUS.RATE_LIMITED,
  PHONE_STATUS.PENDING
];

// Statuses that require admin intervention
const BLOCKED_STATUSES = [
  PHONE_STATUS.BANNED,
  PHONE_STATUS.RATE_LIMITED
];

/**
 * Get access level based on phone status (Task E)
 * @param {string} phoneStatus - Current phone status
 * @returns {Object} - { level, canSend, canRead, degraded, message }
 */
function getAccessLevel(phoneStatus) {
  if (FULL_ACCESS_STATUSES.includes(phoneStatus)) {
    return {
      level: 'full',
      canSend: true,
      canRead: true,
      degraded: false,
      message: null
    };
  }
  
  if (READ_ONLY_STATUSES.includes(phoneStatus)) {
    const messages = {
      [PHONE_STATUS.RESTRICTED]: 'Your account is restricted. Messaging is temporarily disabled.',
      [PHONE_STATUS.FLAGGED]: 'Your account has been flagged for review. Messaging is paused.'
    };
    
    return {
      level: 'read-only',
      canSend: false,
      canRead: true,
      degraded: true,
      message: messages[phoneStatus] || 'Account is in degraded mode.'
    };
  }
  
  // All other statuses block sending
  const messages = {
    [PHONE_STATUS.DISCONNECTED]: 'Phone is disconnected. Please reconnect.',
    [PHONE_STATUS.BANNED]: 'Your phone number has been banned by Meta.',
    [PHONE_STATUS.RATE_LIMITED]: 'You have been rate limited. Please wait.',
    [PHONE_STATUS.PENDING]: 'Phone activation is pending. Please wait.'
  };
  
  return {
    level: 'blocked',
    canSend: false,
    canRead: phoneStatus !== PHONE_STATUS.BANNED, // Banned can't read either
    degraded: true,
    message: messages[phoneStatus] || 'Messaging is blocked.'
  };
}

// Legacy aliases for backward compatibility
const ACTIVE_STATUSES = FULL_ACCESS_STATUSES;

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Require phone to be CONNECTED before allowing access
 * Blocks templates, messages, and campaigns
 */
async function requirePhoneActivation(req, res, next) {
  try {
    // Get workspace from request (set by auth middleware)
    const workspaceId = req.user?.workspace;
    
    if (!workspaceId) {
      return res.status(403).json({
        success: false,
        message: 'No workspace found',
        code: 'NO_WORKSPACE',
        action: 'complete_onboarding',
        redirectTo: '/onboarding/esb'
      });
    }

    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      return res.status(403).json({
        success: false,
        message: 'Workspace not found',
        code: 'WORKSPACE_NOT_FOUND',
        action: 'complete_onboarding',
        redirectTo: '/onboarding/esb'
      });
    }

    // Check if WhatsApp is connected at all
    if (!workspace.whatsappConnected && !workspace.bspManaged) {
      return res.status(403).json({
        success: false,
        message: 'WhatsApp not connected',
        code: 'WHATSAPP_NOT_CONNECTED',
        action: 'connect_whatsapp',
        redirectTo: '/onboarding/esb',
        onboardingStatus: workspace.esbFlow?.status || 'not_started'
      });
    }

    // Get phone status
    const phoneStatus = workspace.bspPhoneStatus || PHONE_STATUS.PENDING;
    const phoneNumberId = workspace.phoneNumberId || workspace.bspPhoneNumberId || workspace.whatsappPhoneNumberId;
    const wabaId = workspace.wabaId || workspace.bspWabaId;

    // Check if phone number exists
    if (!phoneNumberId) {
      return res.status(403).json({
        success: false,
        message: 'Phone number not configured',
        code: 'NO_PHONE_NUMBER',
        action: 'complete_onboarding',
        redirectTo: '/onboarding/esb',
        stage1Status: {
          wabaId: !!wabaId,
          phoneNumberId: false,
          phoneStatus: null
        }
      });
    }

    // Check if WABA exists
    if (!wabaId) {
      return res.status(403).json({
        success: false,
        message: 'WhatsApp Business Account not linked',
        code: 'NO_WABA',
        action: 'complete_onboarding',
        redirectTo: '/onboarding/esb',
        stage1Status: {
          wabaId: false,
          phoneNumberId: !!phoneNumberId,
          phoneStatus: phoneStatus
        }
      });
    }

    // TASK E: Use degradation mode for access control
    const accessLevel = getAccessLevel(phoneStatus);
    
    // Check if phone is permanently blocked (BANNED)
    if (BLOCKED_STATUSES.includes(phoneStatus)) {
      const messages = {
        [PHONE_STATUS.BANNED]: 'Your phone number has been banned by Meta',
        [PHONE_STATUS.RATE_LIMITED]: 'Your phone number is currently rate limited'
      };

      return res.status(403).json({
        success: false,
        message: messages[phoneStatus] || 'Phone number is blocked',
        code: `PHONE_${phoneStatus}`,
        phoneStatus,
        accessLevel: accessLevel.level,
        degraded: accessLevel.degraded,
        action: 'contact_support',
        supportMessage: 'Please contact support to resolve this issue'
      });
    }

    // TASK E: Check degradation mode for sending operations
    if (!accessLevel.canSend) {
      // For read-only statuses, allow read operations
      if (accessLevel.level === 'read-only') {
        const readOnlyMethods = ['GET', 'HEAD', 'OPTIONS'];
        if (readOnlyMethods.includes(req.method)) {
          // Allow read operations with warning
          req.phoneStatus = phoneStatus;
          req.phoneNumberId = phoneNumberId;
          req.wabaId = wabaId;
          req.accessLevel = accessLevel;
          req.stage1Complete = false; // Not fully complete
          return next();
        }
      }
      
      return res.status(403).json({
        success: false,
        message: accessLevel.message || 'Phone number is not yet activated',
        code: accessLevel.level === 'read-only' ? 'PHONE_READ_ONLY' : 'PHONE_NOT_ACTIVATED',
        phoneStatus,
        accessLevel: accessLevel.level,
        degraded: accessLevel.degraded,
        canSend: accessLevel.canSend,
        canRead: accessLevel.canRead,
        action: phoneStatus === PHONE_STATUS.PENDING ? 'wait_for_activation' : 'contact_support',
        stage1Status: {
          wabaId: true,
          phoneNumberId: true,
          phoneStatus: phoneStatus,
          isActivated: false,
          accessLevel: accessLevel.level
        },
        hint: phoneStatus === PHONE_STATUS.PENDING 
          ? 'Your phone number is being provisioned. This usually takes a few minutes.'
          : accessLevel.message
      });
    }

    // Phone is CONNECTED - attach status to request and continue
    req.phoneStatus = phoneStatus;
    req.phoneNumberId = phoneNumberId;
    req.wabaId = wabaId;
    req.stage1Complete = true;
    req.accessLevel = accessLevel; // TASK E: Include access level

    next();
  } catch (error) {
    console.error('[PhoneActivation] Middleware error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error checking phone activation status',
      code: 'ACTIVATION_CHECK_ERROR'
    });
  }
}

/**
 * Soft check - doesn't block but adds status to request
 * Useful for dashboard/status endpoints
 */
async function softPhoneActivationCheck(req, res, next) {
  try {
    const workspaceId = req.user?.workspace;
    
    if (!workspaceId) {
      req.stage1Complete = false;
      req.stage1Status = { error: 'no_workspace' };
      return next();
    }

    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      req.stage1Complete = false;
      req.stage1Status = { error: 'workspace_not_found' };
      return next();
    }

    const phoneStatus = workspace.bspPhoneStatus || PHONE_STATUS.PENDING;
    const phoneNumberId = workspace.phoneNumberId || workspace.bspPhoneNumberId || workspace.whatsappPhoneNumberId;
    const wabaId = workspace.wabaId || workspace.bspWabaId;
    const isConnected = ACTIVE_STATUSES.includes(phoneStatus);

    req.stage1Complete = isConnected && !!phoneNumberId && !!wabaId;
    req.stage1Status = {
      whatsappConnected: workspace.whatsappConnected,
      wabaId: !!wabaId,
      phoneNumberId: !!phoneNumberId,
      phoneStatus,
      isActivated: isConnected,
      qualityRating: workspace.qualityRating || workspace.bspQualityRating,
      messagingTier: workspace.messagingLimitTier || workspace.bspMessagingTier
    };
    req.phoneStatus = phoneStatus;
    req.phoneNumberId = phoneNumberId;
    req.wabaId = wabaId;

    next();
  } catch (error) {
    console.error('[PhoneActivation] Soft check error:', error.message);
    req.stage1Complete = false;
    req.stage1Status = { error: error.message };
    next();
  }
}

/**
 * Get detailed Stage 1 status for a workspace
 * TASK E: Now includes degradation state
 * @param {string} workspaceId - Workspace ID
 * @returns {Object} - Stage 1 completion status
 */
async function getStage1Status(workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      return {
        complete: false,
        error: 'Workspace not found'
      };
    }

    const phoneStatus = workspace.bspPhoneStatus || PHONE_STATUS.PENDING;
    const phoneNumberId = workspace.phoneNumberId || workspace.bspPhoneNumberId || workspace.whatsappPhoneNumberId;
    const wabaId = workspace.wabaId || workspace.bspWabaId;
    const businessId = workspace.businessId;
    const isConnected = ACTIVE_STATUSES.includes(phoneStatus);
    
    // TASK E: Get access level for degradation state
    const accessLevel = getAccessLevel(phoneStatus);

    // Build checklist
    const checklist = {
      businessIdFetched: !!businessId,
      wabaIdFetched: !!wabaId,
      phoneNumberIdFetched: !!phoneNumberId,
      phoneConnected: isConnected,
      webhooksSubscribed: workspace.esbFlow?.status === 'completed'
    };

    const allComplete = Object.values(checklist).every(v => v === true);
    
    // TASK E: Determine blocked features based on access level
    let blockedFeatures = [];
    if (!allComplete || !accessLevel.canSend) {
      blockedFeatures.push('message_sending', 'campaign_creation', 'bulk_messaging');
    }
    if (!allComplete) {
      blockedFeatures.push('template_submission');
    }

    return {
      complete: allComplete,
      checklist,
      details: {
        businessId: businessId || null,
        wabaId: wabaId || null,
        phoneNumberId: phoneNumberId || null,
        phoneNumber: workspace.whatsappPhoneNumber || workspace.bspDisplayPhoneNumber || null,
        phoneStatus,
        verifiedName: workspace.verifiedName || workspace.bspVerifiedName || null,
        qualityRating: workspace.qualityRating || workspace.bspQualityRating || 'UNKNOWN',
        messagingTier: workspace.messagingLimitTier || workspace.bspMessagingTier || 'TIER_NOT_SET',
        onboardingStatus: workspace.esbFlow?.status || 'not_started',
        connectedAt: workspace.connectedAt || workspace.bspOnboardedAt || null,
        // TASK E: Sync status for backoff visibility
        syncStatus: workspace.bspSyncStatus || 'ACTIVE',
        lastSyncedAt: workspace.bspLastSyncedAt || null
      },
      // TASK E: Degradation state exposed in API
      degradation: {
        level: accessLevel.level,
        degraded: accessLevel.degraded,
        canSend: accessLevel.canSend,
        canRead: accessLevel.canRead,
        message: accessLevel.message
      },
      blockedFeatures
    };
  } catch (error) {
    console.error('[PhoneActivation] getStage1Status error:', error.message);
    return {
      complete: false,
      error: error.message
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  requirePhoneActivation,
  softPhoneActivationCheck,
  getStage1Status,
  getAccessLevel,  // TASK E: Export for external use
  PHONE_STATUS,
  ACTIVE_STATUSES,
  BLOCKED_STATUSES,
  // TASK E: Export new status groups
  FULL_ACCESS_STATUSES,
  READ_ONLY_STATUSES,
  SEND_BLOCKED_STATUSES
};
