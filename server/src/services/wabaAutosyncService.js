/**
 * =============================================================================
 * WABA AUTOSYNC SERVICE - INTERAKT BSP MODEL
 * =============================================================================
 * 
 * Automated background job to sync WABA and phone number status.
 * 
 * RESPONSIBILITIES:
 * 1. Retry fetching WABA & phone numbers for pending workspaces
 * 2. Validate app is linked to WABA
 * 3. Run until phone status is CONNECTED
 * 4. Update phone quality ratings and messaging tiers
 * 5. Detect and flag issues (banned, rate limited, etc.)
 * 
 * RUNS:
 * - Every 5 minutes for pending workspaces
 * - Every hour for all connected workspaces (status sync)
 */

const axios = require('axios');
const Workspace = require('../models/Workspace');
const bspConfig = require('../config/bspConfig');
const { logger } = require('../utils/logger');
const { safeDecrypt } = require('../utils/tokenEncryption');

// =============================================================================
// CONFIGURATION
// =============================================================================

const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// Sync intervals
const PENDING_SYNC_INTERVAL = 5 * 60 * 1000;   // 5 minutes
const CONNECTED_SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour

// Max retries for pending workspaces
const MAX_PENDING_RETRIES = 50; // ~4 hours of retries

// =============================================================================
// TASK D: EXPONENTIAL BACKOFF CONFIGURATION
// =============================================================================

// Backoff settings for sync failures
const BACKOFF_CONFIG = {
  initialDelay: 60 * 1000,      // 1 minute
  maxDelay: 30 * 60 * 1000,     // 30 minutes max backoff
  multiplier: 2,                 // Double delay each retry
  maxRetries: 10,                // Mark as FAILED after 10 consecutive failures
  jitterFactor: 0.1              // 10% random jitter
};

// Track backoff state per workspace (in-memory, resets on restart)
const backoffState = new Map();

/**
 * Calculate next backoff delay with exponential increase and jitter
 * @param {string} workspaceId - Workspace identifier
 * @returns {number} - Delay in milliseconds
 */
function getBackoffDelay(workspaceId) {
  const state = backoffState.get(workspaceId) || { retries: 0, lastDelay: 0 };
  
  // Calculate exponential delay
  let delay = BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, state.retries);
  delay = Math.min(delay, BACKOFF_CONFIG.maxDelay);
  
  // Add jitter to prevent thundering herd
  const jitter = delay * BACKOFF_CONFIG.jitterFactor * (Math.random() * 2 - 1);
  delay = Math.max(BACKOFF_CONFIG.initialDelay, delay + jitter);
  
  return Math.floor(delay);
}

/**
 * Record sync failure and update backoff state
 * @param {string} workspaceId - Workspace identifier
 * @returns {Object} - { shouldRetry, nextDelay, totalRetries }
 */
function recordSyncFailure(workspaceId) {
  const state = backoffState.get(workspaceId) || { retries: 0, lastFailure: null };
  state.retries += 1;
  state.lastFailure = new Date();
  state.nextDelay = getBackoffDelay(workspaceId);
  
  backoffState.set(workspaceId, state);
  
  return {
    shouldRetry: state.retries < BACKOFF_CONFIG.maxRetries,
    nextDelay: state.nextDelay,
    totalRetries: state.retries
  };
}

/**
 * Reset backoff state on successful sync
 * @param {string} workspaceId - Workspace identifier
 */
function resetBackoff(workspaceId) {
  backoffState.delete(workspaceId);
}

/**
 * Check if workspace is in backoff period
 * @param {string} workspaceId - Workspace identifier
 * @returns {boolean} - True if should skip sync
 */
function isInBackoff(workspaceId) {
  const state = backoffState.get(workspaceId);
  if (!state || !state.lastFailure) return false;
  
  const elapsed = Date.now() - state.lastFailure.getTime();
  return elapsed < state.nextDelay;
}

// =============================================================================
// META API CALLS
// =============================================================================

/**
 * Fetch owned WhatsApp Business Accounts for a business
 * GET /{business_id}/owned_whatsapp_business_accounts
 */
async function fetchOwnedWABAs(businessId, accessToken) {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${businessId}/owned_whatsapp_business_accounts`,
      {
        params: {
          access_token: accessToken,
          fields: 'id,name,currency,timezone_id,message_template_namespace,account_review_status,on_behalf_of_business_info'
        },
        timeout: 15000
      }
    );

    return {
      success: true,
      wabas: response.data.data || []
    };
  } catch (error) {
    const metaError = error.response?.data?.error;
    return {
      success: false,
      error: metaError?.message || error.message,
      code: metaError?.code
    };
  }
}

/**
 * Fetch phone numbers for a WABA
 * GET /{waba_id}/phone_numbers
 */
async function fetchWABAPhoneNumbers(wabaId, accessToken) {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${wabaId}/phone_numbers`,
      {
        params: {
          access_token: accessToken,
          fields: [
            'id',
            'display_phone_number',
            'verified_name',
            'quality_rating',
            'messaging_limit_tier',
            'code_verification_status',
            'is_official_business_account',
            'account_mode',
            'name_status',
            'new_name_status',
            'status'
          ].join(',')
        },
        timeout: 15000
      }
    );

    return {
      success: true,
      phones: response.data.data || []
    };
  } catch (error) {
    const metaError = error.response?.data?.error;
    return {
      success: false,
      error: metaError?.message || error.message,
      code: metaError?.code
    };
  }
}

/**
 * Get phone number details
 * GET /{phone_number_id}
 */
async function fetchPhoneDetails(phoneNumberId, accessToken) {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${phoneNumberId}`,
      {
        params: {
          access_token: accessToken,
          fields: [
            'id',
            'display_phone_number',
            'verified_name',
            'quality_rating',
            'messaging_limit_tier',
            'code_verification_status',
            'is_official_business_account',
            'account_mode',
            'name_status',
            'new_name_status',
            'status',
            'eligibility_for_api_business_global_search',
            'throughput'
          ].join(',')
        },
        timeout: 15000
      }
    );

    return {
      success: true,
      phone: response.data
    };
  } catch (error) {
    const metaError = error.response?.data?.error;
    return {
      success: false,
      error: metaError?.message || error.message,
      code: metaError?.code
    };
  }
}

/**
 * Check if app is subscribed to WABA webhooks
 * GET /{waba_id}/subscribed_apps
 */
async function checkWebhookSubscription(wabaId, accessToken) {
  try {
    const response = await axios.get(
      `${META_GRAPH_URL}/${wabaId}/subscribed_apps`,
      {
        params: { access_token: accessToken },
        timeout: 15000
      }
    );

    const apps = response.data.data || [];
    const ourApp = apps.find(app => app.whatsapp_business_api_data?.id === process.env.META_APP_ID);

    return {
      success: true,
      subscribed: apps.length > 0,
      ourAppSubscribed: !!ourApp,
      apps
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Subscribe app to WABA webhooks
 * POST /{waba_id}/subscribed_apps
 */
async function subscribeToWebhooks(wabaId, accessToken) {
  try {
    const response = await axios.post(
      `${META_GRAPH_URL}/${wabaId}/subscribed_apps`,
      {},
      {
        params: { access_token: accessToken },
        timeout: 15000
      }
    );

    return {
      success: response.data.success === true
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// =============================================================================
// PHONE STATUS MAPPING
// =============================================================================

/**
 * Map Meta phone status to our internal status
 */
function mapPhoneStatus(metaStatus, accountMode, codeVerificationStatus) {
  // Check account mode first
  if (accountMode === 'SANDBOX') {
    return 'PENDING'; // Still in sandbox
  }

  // Map Meta status values
  const statusMap = {
    'CONNECTED': 'CONNECTED',
    'PENDING': 'PENDING',
    'OFFLINE': 'DISCONNECTED',
    'FLAGGED': 'FLAGGED',
    'RATE_LIMITED': 'RATE_LIMITED',
    'BANNED': 'BANNED',
    'DELETED': 'DISCONNECTED'
  };

  // Check code verification for CONNECTED status
  if (codeVerificationStatus === 'VERIFIED' && accountMode === 'LIVE') {
    return 'CONNECTED';
  }

  return statusMap[metaStatus] || 'PENDING';
}

// =============================================================================
// SYNC OPERATIONS (TASK D: WITH BACKOFF & FAILURE STATE)
// =============================================================================

/**
 * Sync a single workspace's WABA and phone status
 * TASK D: Includes exponential backoff and failure state tracking
 */
async function syncWorkspace(workspace) {
  const workspaceId = workspace._id.toString();
  const updates = {};
  let syncSuccess = false;

  // TASK D: Check if workspace is in backoff period
  if (isInBackoff(workspaceId)) {
    const state = backoffState.get(workspaceId);
    logger.debug(`[WABASync] Workspace ${workspaceId} in backoff, skipping (retry ${state?.retries})`);
    return { success: false, skipped: true, reason: 'backoff' };
  }
  
  // TASK D: Check if workspace is already marked as FAILED
  if (workspace.bspSyncStatus === 'FAILED') {
    // Only retry if enough time has passed (1 hour for failed workspaces)
    const lastSync = workspace.bspLastSyncedAt;
    if (lastSync && (Date.now() - new Date(lastSync).getTime()) < 60 * 60 * 1000) {
      return { success: false, skipped: true, reason: 'failed_status' };
    }
  }

  try {
    // Get access token (try multiple sources)
    let accessToken = bspConfig.systemUserToken; // Primary: BSP system token
    
    // If workspace has its own token (ESB flow), use it for their specific WABA
    if (workspace.accessToken) {
      accessToken = safeDecrypt(workspace.accessToken, workspaceId) || accessToken;
    }

    if (!accessToken) {
      logger.error(`[WABASync] No access token for workspace ${workspaceId}`);
      return { success: false, error: 'No access token' };
    }

    // 1. If we have WABA ID, fetch phone numbers
    if (workspace.wabaId) {
      const phoneResult = await fetchWABAPhoneNumbers(workspace.wabaId, accessToken);
      
      // TASK D: Handle API errors with backoff
      if (!phoneResult.success) {
        const backoffResult = recordSyncFailure(workspaceId);
        logger.warn(`[WABASync] API error for ${workspaceId}, backoff retry ${backoffResult.totalRetries}:`, phoneResult.error);
        
        // Mark as FAILED if max retries exceeded
        if (!backoffResult.shouldRetry) {
          await Workspace.findByIdAndUpdate(workspaceId, {
            $set: {
              bspSyncStatus: 'FAILED',
              'bspAudit.syncFailedAt': new Date(),
              'bspAudit.syncFailureReason': phoneResult.error
            }
          });
          logger.error(`[WABASync] Workspace ${workspaceId} marked as FAILED after ${backoffResult.totalRetries} retries`);
        }
        
        return { success: false, error: phoneResult.error, backoff: backoffResult };
      }
      
      if (phoneResult.phones.length > 0) {
        // Find our phone
        const ourPhone = phoneResult.phones.find(p => 
          p.id === workspace.phoneNumberId || 
          p.id === workspace.bspPhoneNumberId
        ) || phoneResult.phones[0]; // Fallback to first phone

        if (ourPhone) {
          const phoneStatus = mapPhoneStatus(
            ourPhone.status,
            ourPhone.account_mode,
            ourPhone.code_verification_status
          );

          updates.bspPhoneStatus = phoneStatus;
          updates.qualityRating = ourPhone.quality_rating || 'UNKNOWN';
          updates.bspQualityRating = ourPhone.quality_rating || 'UNKNOWN';
          updates.messagingLimitTier = ourPhone.messaging_limit_tier;
          updates.bspMessagingTier = ourPhone.messaging_limit_tier;
          updates.verifiedName = ourPhone.verified_name;
          updates.bspVerifiedName = ourPhone.verified_name;
          updates.nameStatus = ourPhone.name_status || ourPhone.new_name_status;
          updates.isOfficialAccount = ourPhone.is_official_business_account || false;
          updates.codeVerificationStatus = ourPhone.code_verification_status;

          // If phone is now CONNECTED, mark as fully onboarded
          if (phoneStatus === 'CONNECTED') {
            updates.whatsappConnected = true;
            updates['esbFlow.status'] = 'completed';
            if (!workspace.connectedAt) {
              updates.connectedAt = new Date();
              updates.bspOnboardedAt = new Date();
            }
            syncSuccess = true;
          }

          logger.info(`[WABASync] Updated workspace ${workspaceId} - phone status: ${phoneStatus}`);
        }

        // Update all phones list
        updates.phoneNumbers = phoneResult.phones.map(p => ({
          id: p.id,
          displayPhoneNumber: p.display_phone_number,
          verifiedName: p.verified_name,
          qualityRating: p.quality_rating,
          status: p.status
        }));
      }
    }

    // 2. Check webhook subscription
    if (workspace.wabaId) {
      const subResult = await checkWebhookSubscription(workspace.wabaId, accessToken);
      
      if (subResult.success && !subResult.ourAppSubscribed) {
        // Re-subscribe if needed
        const subscribeResult = await subscribeToWebhooks(workspace.wabaId, accessToken);
        if (subscribeResult.success) {
          logger.info(`[WABASync] Re-subscribed to webhooks for workspace ${workspaceId}`);
        }
      }
    }

    // 3. Update workspace
    if (Object.keys(updates).length > 0) {
      updates['bspAudit.lastStatusCheck'] = new Date();
      updates.bspLastSyncedAt = new Date();
      
      // TASK D: Clear FAILED status on successful sync
      if (workspace.bspSyncStatus === 'FAILED') {
        updates.bspSyncStatus = 'ACTIVE';
        updates['bspAudit.syncRecoveredAt'] = new Date();
        logger.info(`[WABASync] Workspace ${workspaceId} recovered from FAILED status`);
      }
      
      // TASK D: Reset backoff on success
      resetBackoff(workspaceId);
      
      // ══════════════════════════════════════════════════════════════════════════
      // TASK E (Stage 3): Check campaign kill-switch trigger
      // Compare before/after state for quality/tier/enforcement changes
      // ══════════════════════════════════════════════════════════════════════════
      try {
        const { onAutosyncComplete } = require('./campaignKillSwitchService');
        
        // Build state snapshots for comparison
        const beforeState = {
          qualityRating: workspace.qualityRating || workspace.bspQualityRating,
          messagingTier: workspace.messagingLimitTier || workspace.bspMessagingTier,
          accountBlocked: workspace.esbFlow?.accountBlocked,
          accountBlockedReason: workspace.esbFlow?.accountBlockedReason,
          capabilityBlocked: workspace.esbFlow?.capabilityBlocked,
          capabilityBlockedReason: workspace.esbFlow?.capabilityBlockedReason,
          metaDecisionStatus: workspace.esbFlow?.metaDecisionStatus
        };
        
        const afterState = {
          qualityRating: updates.qualityRating || updates.bspQualityRating || beforeState.qualityRating,
          messagingTier: updates.messagingLimitTier || updates.bspMessagingTier || beforeState.messagingTier,
          accountBlocked: updates['esbFlow.accountBlocked'] ?? beforeState.accountBlocked,
          accountBlockedReason: updates['esbFlow.accountBlockedReason'] ?? beforeState.accountBlockedReason,
          capabilityBlocked: updates['esbFlow.capabilityBlocked'] ?? beforeState.capabilityBlocked,
          capabilityBlockedReason: updates['esbFlow.capabilityBlockedReason'] ?? beforeState.capabilityBlockedReason,
          metaDecisionStatus: updates['esbFlow.metaDecisionStatus'] ?? beforeState.metaDecisionStatus
        };
        
        const killSwitchResult = await onAutosyncComplete(workspaceId, beforeState, afterState);
        
        if (killSwitchResult.triggered) {
          logger.warn(`[WABASync] Campaign kill-switch triggered for workspace ${workspaceId}: ${killSwitchResult.reason}`);
          logger.warn(`[WABASync] Paused ${killSwitchResult.pausedCampaigns} campaigns`);
        }
      } catch (killSwitchError) {
        // Don't fail autosync if kill-switch has issues
        logger.error(`[WABASync] Kill-switch check error for workspace ${workspaceId}:`, killSwitchError.message);
      }
      
      await Workspace.findByIdAndUpdate(workspaceId, { $set: updates });
      
      return { success: syncSuccess, updates };
    }

    // TASK D: Reset backoff on success (even with no updates)
    resetBackoff(workspaceId);
    return { success: true, message: 'No updates needed' };
  } catch (error) {
    logger.error(`[WABASync] Error syncing workspace ${workspaceId}:`, error.message);
    
    // TASK D: Record failure for backoff
    const backoffResult = recordSyncFailure(workspaceId);
    
    // Mark as FAILED if max retries exceeded
    if (!backoffResult.shouldRetry) {
      await Workspace.findByIdAndUpdate(workspaceId, {
        $set: {
          bspSyncStatus: 'FAILED',
          'bspAudit.syncFailedAt': new Date(),
          'bspAudit.syncFailureReason': error.message
        }
      });
      logger.error(`[WABASync] Workspace ${workspaceId} marked as FAILED`);
    }
    
    return { success: false, error: error.message, backoff: backoffResult };
  }
}

/**
 * Sync pending workspaces (not yet CONNECTED)
 */
async function syncPendingWorkspaces() {
  try {
    logger.info('[WABASync] Starting pending workspace sync...');

    // Find workspaces that are not yet fully connected
    const pendingWorkspaces = await Workspace.find({
      $or: [
        { bspPhoneStatus: 'PENDING' },
        { bspPhoneStatus: { $exists: false } },
        { whatsappConnected: false, wabaId: { $exists: true, $ne: null } }
      ],
      // Only sync workspaces that have started onboarding
      $and: [
        { wabaId: { $exists: true, $ne: null } },
        { phoneNumberId: { $exists: true, $ne: null } }
      ]
    }).limit(50); // Limit batch size

    logger.info(`[WABASync] Found ${pendingWorkspaces.length} pending workspaces`);

    let synced = 0;
    let connected = 0;

    for (const workspace of pendingWorkspaces) {
      const result = await syncWorkspace(workspace);
      synced++;
      if (result.success && result.updates?.bspPhoneStatus === 'CONNECTED') {
        connected++;
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    logger.info(`[WABASync] Pending sync complete: ${synced} synced, ${connected} newly connected`);
    
    return { synced, connected };
  } catch (error) {
    logger.error('[WABASync] Pending sync error:', error.message);
    return { error: error.message };
  }
}

/**
 * Sync all connected workspaces (status refresh)
 */
async function syncConnectedWorkspaces() {
  try {
    logger.info('[WABASync] Starting connected workspace sync...');

    const connectedWorkspaces = await Workspace.find({
      bspPhoneStatus: 'CONNECTED',
      whatsappConnected: true
    }).limit(100);

    logger.info(`[WABASync] Found ${connectedWorkspaces.length} connected workspaces`);

    let synced = 0;
    let statusChanges = 0;

    for (const workspace of connectedWorkspaces) {
      const previousStatus = workspace.bspPhoneStatus;
      const result = await syncWorkspace(workspace);
      synced++;
      
      if (result.updates?.bspPhoneStatus && result.updates.bspPhoneStatus !== previousStatus) {
        statusChanges++;
        logger.warn(`[WABASync] Status change for ${workspace._id}: ${previousStatus} → ${result.updates.bspPhoneStatus}`);
      }
      
      // Delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    logger.info(`[WABASync] Connected sync complete: ${synced} synced, ${statusChanges} status changes`);
    
    return { synced, statusChanges };
  } catch (error) {
    logger.error('[WABASync] Connected sync error:', error.message);
    return { error: error.message };
  }
}

// =============================================================================
// CRON JOBS
// =============================================================================

let pendingSyncInterval = null;
let connectedSyncInterval = null;

/**
 * Start autosync jobs
 */
function startAutosync() {
  logger.info('[WABASync] Starting autosync jobs...');

  // Pending workspaces - every 5 minutes
  pendingSyncInterval = setInterval(async () => {
    try {
      await syncPendingWorkspaces();
    } catch (err) {
      logger.error('[WABASync] Pending sync job error:', err.message);
    }
  }, PENDING_SYNC_INTERVAL);

  // Connected workspaces - every hour
  connectedSyncInterval = setInterval(async () => {
    try {
      await syncConnectedWorkspaces();
    } catch (err) {
      logger.error('[WABASync] Connected sync job error:', err.message);
    }
  }, CONNECTED_SYNC_INTERVAL);

  // Run initial sync after 30 seconds
  setTimeout(() => {
    syncPendingWorkspaces().catch(err => 
      logger.error('[WABASync] Initial sync error:', err.message)
    );
  }, 30000);

  logger.info('[WABASync] ✅ Autosync jobs started');
}

/**
 * Stop autosync jobs
 */
function stopAutosync() {
  if (pendingSyncInterval) {
    clearInterval(pendingSyncInterval);
    pendingSyncInterval = null;
  }
  if (connectedSyncInterval) {
    clearInterval(connectedSyncInterval);
    connectedSyncInterval = null;
  }
  logger.info('[WABASync] Autosync jobs stopped');
}

/**
 * Manual sync trigger for a specific workspace
 */
async function triggerWorkspaceSync(workspaceId) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }
  return await syncWorkspace(workspace);
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Core sync functions
  syncWorkspace,
  syncPendingWorkspaces,
  syncConnectedWorkspaces,
  triggerWorkspaceSync,
  
  // Meta API helpers
  fetchOwnedWABAs,
  fetchWABAPhoneNumbers,
  fetchPhoneDetails,
  checkWebhookSubscription,
  subscribeToWebhooks,
  
  // Cron management
  startAutosync,
  stopAutosync,
  
  // Status mapping
  mapPhoneStatus,
  
  // TASK D: Backoff helpers (for monitoring/debugging)
  getBackoffDelay,
  recordSyncFailure,
  resetBackoff,
  isInBackoff,
  BACKOFF_CONFIG
};
