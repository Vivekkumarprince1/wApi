const Workspace = require('../models/Workspace');
const { logger } = require('../utils/logger');
const gupshupService = require('./gupshupService');

const PENDING_SYNC_INTERVAL = 5 * 60 * 1000;
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
      updates.bspPhoneNumberId = mapped.phoneId;
      updates.activePhoneNumberId = mapped.phoneId;
      updates.whatsappPhoneNumberId = mapped.phoneId;
      updates.phoneNumberId = mapped.phoneId;
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
      console.log(`\n======================================================`);
      console.log(`[GupshupSync] 📥 FETCHED APP DATA FOR: ${workspace.name}`);
      console.log(`[GupshupSync] App Name:      ${app.name}`);
      console.log(`[GupshupSync] Phone Number:  ${app.phone || 'N/A'}`);
      console.log(`[GupshupSync] Customer ID:   ${app.customerId || 'N/A'}`);
      console.log(`[GupshupSync] App ID:        ${app.id}`);
      console.log(`[GupshupSync] Status:        Live: ${app.live}, Healthy: ${app.healthy}`);
      console.log(`======================================================\n`);

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

      // ===== FETCH WABA INFO (Meta WABA ID, verified name, quality, etc.) =====
      if (mapped.bspPhoneStatus === 'CONNECTED' || app.live) {
        try {
          const wabaResponse = await gupshupService.getWabaInfo(app.id);
          const wabaInfo = wabaResponse?.wabaInfo;

          if (wabaInfo) {
            console.log(`\n======================================================`);
            console.log(`[GupshupSync] 🏢 WABA INFO FOR: ${workspace.name}`);
            console.log(`[GupshupSync] WABA ID:          ${wabaInfo.wabaId}`);
            console.log(`[GupshupSync] WABA Name:        ${wabaInfo.wabaName}`);
            console.log(`[GupshupSync] Verified Name:    ${wabaInfo.verifiedName}`);
            console.log(`[GupshupSync] Phone:            ${wabaInfo.phone}`);
            console.log(`[GupshupSync] Messaging Limit:  ${wabaInfo.messagingLimit}`);
            console.log(`[GupshupSync] Phone Quality:    ${wabaInfo.phoneQuality}`);
            console.log(`[GupshupSync] Account Status:   ${wabaInfo.accountStatus}`);
            console.log(`[GupshupSync] MM Lite Status:   ${wabaInfo.mmLiteStatus}`);
            console.log(`[GupshupSync] Ownership:        ${wabaInfo.ownershipType}`);
            console.log(`[GupshupSync] Full WABA Data:\n`, JSON.stringify(wabaInfo, null, 2));
            console.log(`======================================================\n`);

            // Save the Meta WABA ID
            if (wabaInfo.wabaId) {
              updates.wabaId = wabaInfo.wabaId;
            }
            // Save verified name from Meta
            if (wabaInfo.verifiedName) {
              updates.verifiedName = wabaInfo.verifiedName;
            }
            // Save WABA display name
            if (wabaInfo.wabaName) {
              updates.wabaName = wabaInfo.wabaName;
            }
            // Save phone number (formatted from Meta)
            if (wabaInfo.phone) {
              updates.whatsappPhoneNumber = wabaInfo.phone;
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

    console.log(`\n======================================================`);
    console.log(`[GupshupSync] 💾 SAVING TO WORKSPACE DB:`);
    console.log(`[GupshupSync] Data: \n`, JSON.stringify(updates, null, 2));
    console.log(`======================================================\n`);

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
    const workspaces = await Workspace.find({
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
    const workspaces = await Workspace.find({
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
