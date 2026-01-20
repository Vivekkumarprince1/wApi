const Campaign = require('../models/Campaign');
const Workspace = require('../models/Workspace');
const { pauseCampaignJobs } = require('./campaignQueueService');
const CampaignBatch = require('../models/CampaignBatch');
const IORedis = require('ioredis');
const { redisUrl } = require('../config');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GLOBAL CAMPAIGN KILL-SWITCH SERVICE - Task E
 * 
 * Safety mechanism to automatically pause ALL running campaigns when:
 * - WABA quality degrades (to RED)
 * - Messaging tier is downgraded
 * - Meta enforcement is detected
 * 
 * Integrates with autosync data from Stage-1 to detect changes.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Redis connection for kill-switch state
const redis = new IORedis(redisUrl, {
  enableReadyCheck: false,
  maxRetriesPerRequest: 3
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const KILL_SWITCH_KEY = 'campaign:killswitch:';
const KILL_SWITCH_GLOBAL_KEY = 'campaign:killswitch:global';

// Quality rating that triggers kill-switch
const CRITICAL_QUALITY_RATING = 'RED';

// Messaging tiers in order (lower index = lower tier)
const TIER_ORDER = [
  'TIER_NOT_SET',
  'TIER_50',
  'TIER_250',
  'TIER_1K',
  'TIER_10K',
  'TIER_100K',
  'TIER_UNLIMITED'
];

// Kill-switch trigger reasons
const KILL_SWITCH_REASONS = {
  QUALITY_DEGRADED: 'QUALITY_DEGRADED',
  TIER_DOWNGRADED: 'TIER_DOWNGRADED',
  ENFORCEMENT_DETECTED: 'ENFORCEMENT_DETECTED',
  ACCOUNT_BLOCKED: 'ACCOUNT_BLOCKED',
  CAPABILITY_REVOKED: 'CAPABILITY_REVOKED',
  ADMIN_TRIGGERED: 'ADMIN_TRIGGERED'
};

// ─────────────────────────────────────────────────────────────────────────────
// KILL-SWITCH CORE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if kill-switch should be triggered for a workspace
 * Called by autosync service when WABA data is updated
 * @param {String} workspaceId - Workspace ID
 * @param {Object} previousState - Previous quality/tier data
 * @param {Object} currentState - Current quality/tier data from autosync
 * @returns {Object} { triggered, reason, details }
 */
async function checkKillSwitchTrigger(workspaceId, previousState, currentState) {
  const result = {
    triggered: false,
    reason: null,
    details: {}
  };
  
  try {
    // 1. Check quality degradation to RED
    if (currentState.qualityRating === CRITICAL_QUALITY_RATING && 
        previousState.qualityRating !== CRITICAL_QUALITY_RATING) {
      result.triggered = true;
      result.reason = KILL_SWITCH_REASONS.QUALITY_DEGRADED;
      result.details = {
        previousQuality: previousState.qualityRating,
        currentQuality: currentState.qualityRating
      };
      console.log(`[KillSwitch] Quality degraded to RED for workspace: ${workspaceId}`);
    }
    
    // 2. Check messaging tier downgrade
    if (currentState.messagingTier && previousState.messagingTier) {
      const previousTierIndex = TIER_ORDER.indexOf(previousState.messagingTier);
      const currentTierIndex = TIER_ORDER.indexOf(currentState.messagingTier);
      
      // Only trigger if both tiers are known and current is lower
      if (previousTierIndex !== -1 && currentTierIndex !== -1 && 
          currentTierIndex < previousTierIndex) {
        result.triggered = true;
        result.reason = KILL_SWITCH_REASONS.TIER_DOWNGRADED;
        result.details = {
          previousTier: previousState.messagingTier,
          currentTier: currentState.messagingTier
        };
        console.log(`[KillSwitch] Tier downgraded for workspace: ${workspaceId}`);
      }
    }
    
    // 3. Check account blocked
    if (currentState.accountBlocked && !previousState.accountBlocked) {
      result.triggered = true;
      result.reason = KILL_SWITCH_REASONS.ACCOUNT_BLOCKED;
      result.details = {
        blockReason: currentState.accountBlockedReason
      };
      console.log(`[KillSwitch] Account blocked for workspace: ${workspaceId}`);
    }
    
    // 4. Check capability revoked
    if (currentState.capabilityBlocked && !previousState.capabilityBlocked) {
      result.triggered = true;
      result.reason = KILL_SWITCH_REASONS.CAPABILITY_REVOKED;
      result.details = {
        blockReason: currentState.capabilityBlockedReason
      };
      console.log(`[KillSwitch] Capability revoked for workspace: ${workspaceId}`);
    }
    
    // 5. Check Meta enforcement (metaDecisionStatus)
    const enforcementStatuses = ['DISABLED', 'PENDING_DELETION', 'UNDER_REVIEW'];
    if (enforcementStatuses.includes(currentState.metaDecisionStatus) &&
        !enforcementStatuses.includes(previousState.metaDecisionStatus)) {
      result.triggered = true;
      result.reason = KILL_SWITCH_REASONS.ENFORCEMENT_DETECTED;
      result.details = {
        decisionStatus: currentState.metaDecisionStatus
      };
      console.log(`[KillSwitch] Enforcement detected for workspace: ${workspaceId}`);
    }
    
    // Execute kill-switch if triggered
    if (result.triggered) {
      const pauseResult = await executeWorkspaceKillSwitch(workspaceId, result.reason, result.details);
      result.pausedCampaigns = pauseResult.pausedCampaigns;
      result.pausedBatches = pauseResult.pausedBatches;
    }
    
    return result;
  } catch (error) {
    console.error(`[KillSwitch] Error checking trigger for workspace ${workspaceId}:`, error);
    return {
      triggered: false,
      error: error.message
    };
  }
}

/**
 * Execute kill-switch for a workspace - pause all running campaigns
 * @param {String} workspaceId - Workspace ID
 * @param {String} reason - Kill-switch reason
 * @param {Object} details - Additional details
 * @returns {Object} { pausedCampaigns, pausedBatches }
 */
async function executeWorkspaceKillSwitch(workspaceId, reason, details = {}) {
  const result = {
    pausedCampaigns: 0,
    pausedBatches: 0,
    campaignIds: []
  };
  
  try {
    // Find all running campaigns for this workspace
    const runningCampaigns = await Campaign.find({
      workspace: workspaceId,
      status: 'RUNNING'
    }).select('_id name');
    
    if (runningCampaigns.length === 0) {
      console.log(`[KillSwitch] No running campaigns to pause for workspace: ${workspaceId}`);
      return result;
    }
    
    console.log(`[KillSwitch] Pausing ${runningCampaigns.length} campaigns for workspace: ${workspaceId}`);
    
    // Pause each campaign
    for (const campaign of runningCampaigns) {
      try {
        // Remove jobs from queue
        await pauseCampaignJobs(campaign._id);
        
        // Update campaign status using systemPause
        await Campaign.systemPause(campaign._id, reason);
        
        // Update batches to PAUSED
        const batchResult = await CampaignBatch.updateMany(
          { campaign: campaign._id, status: { $in: ['PENDING', 'QUEUED'] } },
          { $set: { status: 'PAUSED' } }
        );
        
        result.pausedCampaigns++;
        result.pausedBatches += batchResult.modifiedCount;
        result.campaignIds.push(campaign._id.toString());
        
        console.log(`[KillSwitch] Paused campaign: ${campaign._id} (${campaign.name})`);
      } catch (err) {
        console.error(`[KillSwitch] Failed to pause campaign ${campaign._id}:`, err.message);
      }
    }
    
    // Store kill-switch event in Redis for audit
    const killSwitchEvent = {
      workspaceId,
      reason,
      details,
      pausedCampaigns: result.pausedCampaigns,
      campaignIds: result.campaignIds,
      triggeredAt: new Date().toISOString()
    };
    
    await redis.setex(
      `${KILL_SWITCH_KEY}${workspaceId}:${Date.now()}`,
      7 * 24 * 60 * 60, // 7 days TTL
      JSON.stringify(killSwitchEvent)
    );
    
    console.log(`[KillSwitch] Completed - paused ${result.pausedCampaigns} campaigns, ${result.pausedBatches} batches`);
    return result;
  } catch (error) {
    console.error(`[KillSwitch] Error executing for workspace ${workspaceId}:`, error);
    throw error;
  }
}

/**
 * Global kill-switch - pause ALL campaigns across ALL workspaces
 * Use only in emergency situations (e.g., BSP-wide Meta issue)
 * @param {String} reason - Reason for global kill-switch
 * @param {String} triggeredBy - Admin ID who triggered
 * @returns {Object} { totalPaused, workspaces }
 */
async function executeGlobalKillSwitch(reason, triggeredBy) {
  const result = {
    totalPaused: 0,
    workspaces: [],
    triggeredAt: new Date().toISOString(),
    triggeredBy
  };
  
  try {
    console.log(`[KillSwitch] GLOBAL KILL-SWITCH ACTIVATED by ${triggeredBy}: ${reason}`);
    
    // Find all running campaigns across all workspaces
    const runningCampaigns = await Campaign.find({
      status: 'RUNNING'
    }).select('_id workspace name');
    
    if (runningCampaigns.length === 0) {
      console.log('[KillSwitch] No running campaigns to pause globally');
      return result;
    }
    
    // Group by workspace
    const workspaceMap = new Map();
    for (const campaign of runningCampaigns) {
      const wsId = campaign.workspace.toString();
      if (!workspaceMap.has(wsId)) {
        workspaceMap.set(wsId, []);
      }
      workspaceMap.get(wsId).push(campaign);
    }
    
    // Pause all campaigns
    for (const [workspaceId, campaigns] of workspaceMap) {
      const wsResult = await executeWorkspaceKillSwitch(
        workspaceId, 
        KILL_SWITCH_REASONS.ADMIN_TRIGGERED, 
        { globalKillSwitch: true, reason, triggeredBy }
      );
      
      result.totalPaused += wsResult.pausedCampaigns;
      result.workspaces.push({
        workspaceId,
        pausedCampaigns: wsResult.pausedCampaigns
      });
    }
    
    // Store global kill-switch state
    await redis.setex(
      KILL_SWITCH_GLOBAL_KEY,
      24 * 60 * 60, // 24 hours TTL
      JSON.stringify({
        active: true,
        reason,
        triggeredBy,
        triggeredAt: result.triggeredAt,
        totalPaused: result.totalPaused
      })
    );
    
    console.log(`[KillSwitch] GLOBAL - Paused ${result.totalPaused} campaigns across ${result.workspaces.length} workspaces`);
    return result;
  } catch (error) {
    console.error('[KillSwitch] Global kill-switch error:', error);
    throw error;
  }
}

/**
 * Check if global kill-switch is active
 * Should be called before starting any new campaign
 * @returns {Object} { active, reason, triggeredAt }
 */
async function isGlobalKillSwitchActive() {
  try {
    const state = await redis.get(KILL_SWITCH_GLOBAL_KEY);
    if (!state) {
      return { active: false };
    }
    
    const killSwitchState = JSON.parse(state);
    return {
      active: killSwitchState.active || false,
      reason: killSwitchState.reason,
      triggeredAt: killSwitchState.triggeredAt,
      triggeredBy: killSwitchState.triggeredBy
    };
  } catch (error) {
    console.error('[KillSwitch] Error checking global state:', error);
    return { active: false, error: error.message };
  }
}

/**
 * Deactivate global kill-switch (admin action)
 * @param {String} deactivatedBy - Admin ID
 * @returns {Object} { deactivated }
 */
async function deactivateGlobalKillSwitch(deactivatedBy) {
  try {
    await redis.del(KILL_SWITCH_GLOBAL_KEY);
    console.log(`[KillSwitch] Global kill-switch deactivated by: ${deactivatedBy}`);
    return { deactivated: true, deactivatedBy, at: new Date().toISOString() };
  } catch (error) {
    console.error('[KillSwitch] Error deactivating:', error);
    return { deactivated: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTOSYNC INTEGRATION HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to be called by wabaAutosyncService after syncing workspace data
 * Extracts relevant fields and checks kill-switch trigger
 * @param {String} workspaceId - Workspace ID
 * @param {Object} beforeUpdate - Workspace state before autosync
 * @param {Object} afterUpdate - Workspace state after autosync
 */
async function onAutosyncComplete(workspaceId, beforeUpdate, afterUpdate) {
  const previousState = {
    qualityRating: beforeUpdate.qualityRating || beforeUpdate.bspQualityRating,
    messagingTier: beforeUpdate.messagingLimitTier || beforeUpdate.bspMessagingTier,
    accountBlocked: beforeUpdate.esbFlow?.accountBlocked,
    accountBlockedReason: beforeUpdate.esbFlow?.accountBlockedReason,
    capabilityBlocked: beforeUpdate.esbFlow?.capabilityBlocked,
    capabilityBlockedReason: beforeUpdate.esbFlow?.capabilityBlockedReason,
    metaDecisionStatus: beforeUpdate.esbFlow?.metaDecisionStatus
  };
  
  const currentState = {
    qualityRating: afterUpdate.qualityRating || afterUpdate.bspQualityRating,
    messagingTier: afterUpdate.messagingLimitTier || afterUpdate.bspMessagingTier,
    accountBlocked: afterUpdate.esbFlow?.accountBlocked,
    accountBlockedReason: afterUpdate.esbFlow?.accountBlockedReason,
    capabilityBlocked: afterUpdate.esbFlow?.capabilityBlocked,
    capabilityBlockedReason: afterUpdate.esbFlow?.capabilityBlockedReason,
    metaDecisionStatus: afterUpdate.esbFlow?.metaDecisionStatus
  };
  
  return checkKillSwitchTrigger(workspaceId, previousState, currentState);
}

/**
 * Get kill-switch history for a workspace
 * @param {String} workspaceId - Workspace ID
 * @returns {Array} Kill-switch events
 */
async function getKillSwitchHistory(workspaceId) {
  try {
    const pattern = `${KILL_SWITCH_KEY}${workspaceId}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }
    
    const events = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        events.push(JSON.parse(data));
      }
    }
    
    // Sort by triggeredAt descending
    events.sort((a, b) => new Date(b.triggeredAt) - new Date(a.triggeredAt));
    
    return events;
  } catch (error) {
    console.error(`[KillSwitch] Error getting history for ${workspaceId}:`, error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKSPACE STATUS CHECK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a workspace is safe for campaign execution
 * Combined check for all kill-switch conditions
 * @param {String} workspaceId - Workspace ID
 * @returns {Object} { safe, reason, recommendations }
 */
async function isWorkspaceSafeForCampaigns(workspaceId) {
  const result = {
    safe: true,
    reason: null,
    recommendations: [],
    checks: {}
  };
  
  try {
    // Check global kill-switch first
    const globalState = await isGlobalKillSwitchActive();
    if (globalState.active) {
      result.safe = false;
      result.reason = 'Global campaign kill-switch is active';
      result.checks.globalKillSwitch = { active: true, ...globalState };
      return result;
    }
    result.checks.globalKillSwitch = { active: false };
    
    // Load workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      result.safe = false;
      result.reason = 'Workspace not found';
      return result;
    }
    
    // Check quality rating
    const qualityRating = workspace.qualityRating || workspace.bspQualityRating || 'UNKNOWN';
    if (qualityRating === 'RED') {
      result.safe = false;
      result.reason = 'Phone quality rating is RED';
      result.checks.qualityRating = { status: 'CRITICAL', rating: qualityRating };
    } else if (qualityRating === 'YELLOW') {
      result.recommendations.push('Quality rating is YELLOW - consider reducing volume');
      result.checks.qualityRating = { status: 'WARNING', rating: qualityRating };
    } else {
      result.checks.qualityRating = { status: 'OK', rating: qualityRating };
    }
    
    // Check account blocked
    if (workspace.esbFlow?.accountBlocked) {
      result.safe = false;
      result.reason = 'Account is blocked';
      result.checks.accountStatus = { status: 'BLOCKED', reason: workspace.esbFlow?.accountBlockedReason };
    } else {
      result.checks.accountStatus = { status: 'OK' };
    }
    
    // Check capability blocked
    if (workspace.esbFlow?.capabilityBlocked) {
      result.safe = false;
      result.reason = 'Messaging capability is blocked';
      result.checks.capability = { status: 'BLOCKED', reason: workspace.esbFlow?.capabilityBlockedReason };
    } else {
      result.checks.capability = { status: 'OK' };
    }
    
    return result;
  } catch (error) {
    console.error(`[KillSwitch] Error checking workspace safety ${workspaceId}:`, error);
    return {
      safe: false,
      reason: 'Error checking workspace status',
      error: error.message
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Core functions
  checkKillSwitchTrigger,
  executeWorkspaceKillSwitch,
  executeGlobalKillSwitch,
  
  // Global switch control
  isGlobalKillSwitchActive,
  deactivateGlobalKillSwitch,
  
  // Autosync integration
  onAutosyncComplete,
  
  // Status checks
  isWorkspaceSafeForCampaigns,
  getKillSwitchHistory,
  
  // Constants
  KILL_SWITCH_REASONS,
  TIER_ORDER,
  CRITICAL_QUALITY_RATING,
  
  // Redis instance (for testing)
  redis
};
