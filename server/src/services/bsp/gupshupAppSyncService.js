const { Workspace } = require('../../models');
const logger = require('../../utils/logger');
const gupshupService = require('./gupshupService');
const { getIO } = require('../../utils/socket');

const PENDING_SYNC_INTERVAL = 15 * 60 * 1000;
const CONNECTED_SYNC_INTERVAL = 60 * 60 * 1000;

const BACKOFF_CONFIG = {
  initialDelay: 60 * 1000,
  maxDelay: 30 * 60 * 1000,
  multiplier: 2,
  maxRetries: 10,
  jitterFactor: 0.1
};

const backoffState = new Map();

function getBackoffDelay(workspaceId) {
  const state = backoffState.get(workspaceId) || { retries: 0 };
  let delay = BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, state.retries);
  delay = Math.min(delay, BACKOFF_CONFIG.maxDelay);
  const jitter = delay * BACKOFF_CONFIG.jitterFactor * (Math.random() * 2 - 1);
  delay = Math.max(BACKOFF_CONFIG.initialDelay, delay + jitter);
  return Math.floor(delay);
}

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

function resetBackoff(workspaceId) {
  backoffState.delete(workspaceId);
}

function isInBackoff(workspaceId) {
  const state = backoffState.get(workspaceId);
  if (!state || !state.lastFailure) return false;
  const elapsed = Date.now() - state.lastFailure.getTime();
  return elapsed < state.nextDelay;
}

/**
 * Get IDs of workspaces that have active socket connections
 */
function getActiveWorkspaceIds() {
  const io = getIO();
  if (!io) return [];

  const activeWorkspaces = new Set();
  const rooms = io.sockets.adapter.rooms;

  for (const [roomName] of rooms) {
    if (roomName.startsWith('workspace:')) {
      const workspaceId = roomName.split(':')[1];
      if (workspaceId) {
        activeWorkspaces.add(workspaceId);
      }
    }
  }

  return Array.from(activeWorkspaces);
}

async function fetchPartnerApps() {
  const response = await gupshupService.getPartnerApps();
  return response?.partnerAppsList || response?.data || [];
}

function mapAppStatus(app) {
  if (!app) {
    return {
      bspPhoneStatus: 'DISCONNECTED',
      whatsappConnected: false,
      isOfficialAccount: false,
      gupshupAppLive: false,
      gupshupAppHealth: null,
      phoneId: null
    };
  }

  const hasPhone = !!app.phone;
  const live = !!app.live;

  return {
    bspPhoneStatus: hasPhone ? (live ? 'CONNECTED' : 'PENDING') : 'PENDING',
    whatsappConnected: hasPhone,
    isOfficialAccount: live,
    gupshupAppLive: live,
    gupshupAppHealth: app.healthy === undefined ? null : !!app.healthy,
    phoneId: app.phone || null
  };
}

async function syncWorkspace(workspace) {
  const workspaceId = workspace._id.toString();

  if (isInBackoff(workspaceId)) {
    return { success: false, skipped: true, reason: 'backoff' };
  }

  try {
    const apps = await fetchPartnerApps();
    const app = apps.find((item) => item.id === workspace.gupshupAppId) || null;
    const mapped = mapAppStatus(app);

    const updates = {
      bspPhoneStatus: mapped.bspPhoneStatus,
      whatsappConnected: mapped.whatsappConnected,
      isOfficialAccount: mapped.isOfficialAccount,
      gupshupAppLive: mapped.gupshupAppLive,
      gupshupAppHealth: mapped.gupshupAppHealth,
      bspLastSyncedAt: new Date(),
      'bspAudit.lastStatusCheck': new Date(),
      bspSyncStatus: 'ACTIVE',
      qualityRating: undefined,
      bspQualityRating: undefined,
      messagingLimitTier: undefined,
      bspMessagingTier: undefined,
      nameStatus: undefined,
      codeVerificationStatus: undefined
    };

    const unsetFields = {};

    // NEVER unset connection data if we already manually confirmed it live!
    if (mapped.phoneId) {
      // mapped.phoneId is just the raw string "15557225924", NOT the Meta ID!
      updates.whatsappPhoneNumber = mapped.phoneId;
      updates.bspDisplayPhoneNumber = mapped.phoneId;
      updates.whatsappConnected = true;
      updates.bspPhoneStatus = 'CONNECTED';
      updates.isOfficialAccount = true;
      updates.gupshupAppLive = true;
    } else if (!workspace.phoneNumberId && !workspace.whatsappConnected) {
      // Only set to false/pending if it was NEVER connected in the first place
      updates.whatsappConnected = false;
      updates.isOfficialAccount = false;
      updates.gupshupAppLive = false;
    } else {
      // It is currently connected in DB, but Gupshup API cache is lagging and returned null.
      // DONT update connection fields to void!
      delete updates.whatsappConnected;
      delete updates.isOfficialAccount;
      delete updates.gupshupAppLive;
      delete updates.bspPhoneStatus;
    }

    if (app) {
      logger.debug(`\n======================================================`);
      logger.debug(`[GupshupSync] 📥 FETCHED APP DATA FOR: ${workspace.name}`);
      logger.debug(`[GupshupSync] App Name:      ${app.name}`);
      logger.debug(`[GupshupSync] Phone Number:  ${app.phone || 'N/A'}`);
      logger.debug(`[GupshupSync] Customer ID:   ${app.customerId || 'N/A'}`);
      logger.debug(`[GupshupSync] App ID:        ${app.id}`);
      logger.debug(`[GupshupSync] Status:        Live: ${app.live}, Healthy: ${app.healthy}`);
      logger.debug(`======================================================\n`);

      updates.phoneNumbers = app.phone
        ? [{ id: app.phone, displayPhoneNumber: app.phone, verifiedName: app.name, qualityRating: null, status: mapped.bspPhoneStatus }]
        : (workspace.phoneNumbers || []);
      updates.connectedAt = workspace.connectedAt || (mapped.whatsappConnected ? new Date() : null);
      updates.bspOnboardedAt = workspace.bspOnboardedAt || (mapped.whatsappConnected ? new Date() : null);

      // Save App Name
      updates.gupshupAppName = app.name;

      // Save businessId from Gupshup's customerId
      if (app.customerId && !workspace.businessId) {
        updates.businessId = app.customerId;
      }

      // ===== FETCH SPECIFIC PARTNER APP DETAILS (phone_number_id, waba_id) =====
      try {
        const fullApp = await gupshupService.getPartnerApp(app.id);
        const fbProfile = fullApp?.facebookProfile || fullApp?.partnerApp?.facebookProfile || {};

        const wabaId = fbProfile.waba_id;
        const phone_number_id = fbProfile.phone_number_id;

        if (wabaId) {
          updates.wabaId = wabaId;
          updates.bspWabaId = wabaId;
        }

        if (phone_number_id && phone_number_id !== updates.whatsappPhoneNumber) {
          updates.phoneNumberId = phone_number_id;
          updates.whatsappPhoneNumberId = phone_number_id;
          updates.bspPhoneNumberId = phone_number_id;
        }
      } catch (appErr) {
        logger.warn(`[GupshupSync] Failed to fetch full app details for ${app.id}: ${appErr.message}`);
      }

      // ===== FETCH WABA INFO (Meta WABA ID, verified name, quality, etc.) =====
      if (mapped.bspPhoneStatus === 'CONNECTED' || app.live) {
        try {
          const wabaResponse = await gupshupService.getWabaInfo(app.id);
          const wabaInfo = wabaResponse?.wabaInfo;

          if (wabaInfo) {
            logger.debug(`\n======================================================`);
            logger.debug(`[GupshupSync] 🏢 WABA INFO FOR: ${workspace.name}`);
            logger.debug(`[GupshupSync] WABA ID:          ${wabaInfo.wabaId || updates.wabaId}`);
            logger.debug(`[GupshupSync] WABA Name:        ${wabaInfo.wabaName}`);
            logger.debug(`[GupshupSync] Verified Name:    ${wabaInfo.verifiedName}`);
            logger.debug(`[GupshupSync] Phone:            ${wabaInfo.phone}`);
            logger.debug(`[GupshupSync] Messaging Limit:  ${wabaInfo.messagingLimit}`);
            logger.debug(`[GupshupSync] Phone Quality:    ${wabaInfo.phoneQuality}`);
            logger.debug(`[GupshupSync] Account Status:   ${wabaInfo.accountStatus}`);
            logger.debug(`[GupshupSync] MM Lite Status:   ${wabaInfo.mmLiteStatus}`);
            logger.debug(`[GupshupSync] Ownership:        ${wabaInfo.ownershipType}`);
            logger.debug(`[GupshupSync] Full WABA Data:\n`, JSON.stringify(wabaInfo, null, 2));
            logger.debug(`======================================================\n`);

            // Save the Meta WABA ID (Fallback to wabaInfo if explicit fetch failed)
            if (wabaInfo.wabaId && !updates.wabaId) {
              updates.wabaId = wabaInfo.wabaId;
              updates.bspWabaId = wabaInfo.wabaId;
            }
            // Save verified name from Meta
            if (wabaInfo.verifiedName) {
              updates.verifiedName = wabaInfo.verifiedName;
              updates.bspVerifiedName = wabaInfo.verifiedName;
            }
            // Save WABA display name
            if (wabaInfo.wabaName) {
              updates.wabaName = wabaInfo.wabaName;
            }
            // Save phone number (formatted from Meta)
            if (wabaInfo.phone) {
              updates.whatsappPhoneNumber = wabaInfo.phone;
              updates.bspDisplayPhoneNumber = wabaInfo.phone;
            }
            // Extract the TRUE phone_number_id from Meta (Fallback)
            if (!updates.phoneNumberId && (wabaInfo.phoneNumberId || wabaInfo.phone_number_id || wabaInfo.id)) {
              const trueId = wabaInfo.phoneNumberId || wabaInfo.phone_number_id || wabaInfo.id;
              if (trueId !== updates.whatsappPhoneNumber) { // Prevent strings like "1555..." from being saved
                updates.phoneNumberId = trueId;
                updates.whatsappPhoneNumberId = trueId;
                updates.bspPhoneNumberId = trueId;
              }
            }
            // Save quality rating
            if (wabaInfo.phoneQuality) {
              updates.qualityRating = wabaInfo.phoneQuality;
              updates.bspQualityRating = wabaInfo.phoneQuality;
            }
            // Save messaging tier
            if (wabaInfo.messagingLimit) {
              updates.messagingLimitTier = wabaInfo.messagingLimit;
              updates.bspMessagingTier = wabaInfo.messagingLimit;
            }

            console.log(`[GupshupSync] WABA mapping for ${workspace.name}:`, {
              phoneNumber: updates.whatsappPhoneNumber,
              phoneNumberId: updates.phoneNumberId,
              wabaId: updates.wabaId
            });
          }
        } catch (wabaErr) {
          console.warn(`[GupshupSync] ⚠️ Failed to fetch WABA info for app ${app.id}:`, wabaErr.message);
          // Non-fatal — continue with whatever data we have
        }
      }

      // If phone is connected, mark esbFlow as completed so features unlock 
      if (mapped.bspPhoneStatus === 'CONNECTED') {
        updates['esbFlow.status'] = 'completed';
        updates['esbFlow.completedAt'] = workspace.esbFlow?.completedAt || new Date();
        updates.onboardingStatus = 'LIVE';
        updates.bspManaged = true;

        // CRITICAL: If Gupshup says it's not live yet, tell it to go live!
        if (app.live === false) {
          console.log(`[GupshupSync] App ${app.id} is connected but NOT LIVE. Triggering Go-Live...`);
          gupshupService.goLive({ appId: app.id }).catch(err => {
            console.error(`[GupshupSync] Failed to trigger auto Go-Live for ${app.id}:`, err.message);
          });
        }
      }
    } else if (!workspace.whatsappConnected) {
      // Only reset phone numbers if workspace was never connected
      updates.phoneNumbers = [];
      updates.connectedAt = null;
    }

    logger.debug(`\n======================================================`);
    logger.debug(`[GupshupSync] 💾 SAVING TO WORKSPACE DB:`);
    logger.debug(`[GupshupSync] Data: \n`, JSON.stringify(updates, null, 2));
    logger.debug(`======================================================\n`);

    await Workspace.findByIdAndUpdate(workspace._id, {
      $set: updates,
      $unset: unsetFields
    });

    resetBackoff(workspaceId);
    return { success: true, appFound: !!app, updates };
  } catch (error) {
    const backoffResult = recordSyncFailure(workspaceId);

    await Workspace.findByIdAndUpdate(workspace._id, {
      $set: {
        bspPhoneStatus: 'UNKNOWN',
        gupshupAppLive: null,
        gupshupAppHealth: null,
        bspLastSyncedAt: new Date(),
        'bspAudit.lastStatusCheck': new Date(),
        'bspAudit.syncFailureReason': error.message
      }
    });

    logger.warn(`[GupshupAppSync] Sync failed for workspace ${workspaceId}: ${error.message}`);
    return { success: false, error: error.message, backoff: backoffResult };
  }
}

async function syncPendingWorkspaces() {
  try {
    const activeIds = getActiveWorkspaceIds();
    if (activeIds.length === 0) return { synced: 0, connected: 0, reason: 'no_active_sessions' };

    const workspaces = await Workspace.find({
      _id: { $in: activeIds },
      $or: [
        { bspPhoneStatus: { $in: ['PENDING', 'UNKNOWN'] } },
        { bspPhoneStatus: { $exists: false } },
        { whatsappConnected: false }
      ],
      gupshupAppId: { $exists: true, $ne: null }
    }).limit(50);

    let synced = 0;
    let connected = 0;

    for (const workspace of workspaces) {
      const result = await syncWorkspace(workspace);
      synced++;
      if (result.success && result.updates?.bspPhoneStatus === 'CONNECTED') {
        connected++;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return { synced, connected };
  } catch (error) {
    logger.error('[GupshupAppSync] Pending sync error:', error.message);
    return { error: error.message };
  }
}

async function syncConnectedWorkspaces() {
  try {
    const activeIds = getActiveWorkspaceIds();
    if (activeIds.length === 0) return { synced: 0, statusChanges: 0, reason: 'no_active_sessions' };

    const workspaces = await Workspace.find({
      _id: { $in: activeIds },
      whatsappConnected: true,
      gupshupAppId: { $exists: true, $ne: null }
    }).limit(100);

    let synced = 0;
    let statusChanges = 0;

    for (const workspace of workspaces) {
      const previousStatus = workspace.bspPhoneStatus;
      const result = await syncWorkspace(workspace);
      synced++;
      if (result.success && result.updates?.bspPhoneStatus !== previousStatus) {
        statusChanges++;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return { synced, statusChanges };
  } catch (error) {
    logger.error('[GupshupAppSync] Connected sync error:', error.message);
    return { error: error.message };
  }
}

let pendingSyncInterval = null;
let connectedSyncInterval = null;

function startAutosync() {
  logger.info('[GupshupAppSync] Starting autosync jobs...');

  pendingSyncInterval = setInterval(async () => {
    try {
      await syncPendingWorkspaces();
    } catch (err) {
      logger.error('[GupshupAppSync] Pending sync job error:', err.message);
    }
  }, PENDING_SYNC_INTERVAL);

  connectedSyncInterval = setInterval(async () => {
    try {
      await syncConnectedWorkspaces();
    } catch (err) {
      logger.error('[GupshupAppSync] Connected sync job error:', err.message);
    }
  }, CONNECTED_SYNC_INTERVAL);

  setTimeout(() => {
    syncPendingWorkspaces().catch((err) => logger.error('[GupshupAppSync] Initial sync error:', err.message));
  }, 30000);

  logger.info('[GupshupAppSync] ✅ Autosync jobs started');
}

function stopAutosync() {
  if (pendingSyncInterval) clearInterval(pendingSyncInterval);
  if (connectedSyncInterval) clearInterval(connectedSyncInterval);
  pendingSyncInterval = null;
  connectedSyncInterval = null;
  logger.info('[GupshupAppSync] Autosync jobs stopped');
}

async function triggerWorkspaceSync(workspaceId) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  return syncWorkspace(workspace);
}

module.exports = {
  fetchPartnerApps,
  syncWorkspace,
  syncPendingWorkspaces,
  syncConnectedWorkspaces,
  triggerWorkspaceSync,
  startAutosync,
  stopAutosync,
  getBackoffDelay,
  recordSyncFailure,
  resetBackoff,
  isInBackoff,
  BACKOFF_CONFIG
};
