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

    const unsetFields = {
      qualityRating: 1,
      bspQualityRating: 1,
      messagingLimitTier: 1,
      bspMessagingTier: 1,
      nameStatus: 1,
      codeVerificationStatus: 1
    };

    if (mapped.phoneId) {
      updates.bspPhoneNumberId = mapped.phoneId;
      updates.activePhoneNumberId = mapped.phoneId;
      updates.whatsappPhoneNumberId = mapped.phoneId;
      updates.phoneNumberId = mapped.phoneId;
    } else {
      unsetFields.bspPhoneNumberId = 1;
      unsetFields.activePhoneNumberId = 1;
      unsetFields.whatsappPhoneNumberId = 1;
      unsetFields.phoneNumberId = 1;
    }

    if (app) {
      updates.phoneNumbers = app.phone
        ? [{ id: app.phone, displayPhoneNumber: app.phone, verifiedName: app.name, qualityRating: null, status: mapped.bspPhoneStatus }]
        : [];
      updates.connectedAt = workspace.connectedAt || (mapped.whatsappConnected ? new Date() : null);
      updates.bspOnboardedAt = workspace.bspOnboardedAt || (mapped.whatsappConnected ? new Date() : null);
    } else {
      updates.phoneNumbers = [];
      updates.connectedAt = null;
    }

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
