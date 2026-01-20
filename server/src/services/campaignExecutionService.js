const Campaign = require('../models/Campaign');
const CampaignBatch = require('../models/CampaignBatch');
const CampaignMessage = require('../models/CampaignMessage');
const Template = require('../models/Template');
const Contact = require('../models/Contact');
const Workspace = require('../models/Workspace');
const { enqueueCampaign, scheduleCampaign, pauseCampaignJobs, getCampaignJobsStatus } = require('./campaignQueueService');
const { validateCampaignCreation, validateCampaignStart, PLAN_LIMITS } = require('./campaignValidationService');

// ═══════════════════════════════════════════════════════════════════════════════
// HARDENING IMPORTS (Tasks A-E)
// ═══════════════════════════════════════════════════════════════════════════════
const { 
  acquireCampaignLock, 
  releaseCampaignLock, 
  checkCampaignLock 
} = require('./campaignLockService');

const { 
  validateCampaignExecution, 
  getResumableBatches,
  verifyBatchNotCompleted 
} = require('./campaignPreflightService');

const { 
  isGlobalKillSwitchActive, 
  isWorkspaceSafeForCampaigns 
} = require('./campaignKillSwitchService');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN EXECUTION SERVICE - Stage 3 Implementation (Hardened)
 * 
 * High-level campaign lifecycle management:
 * - Campaign creation with validation
 * - Start/Schedule/Pause/Resume operations
 * - Progress tracking
 * - Summary generation
 * 
 * HARDENING (Tasks A-E):
 * - Execution lock prevents duplicate starts (Task A)
 * - Batch finality guarantees on resume (Task B)
 * - Preflight validation before execution (Task C)
 * - Audit metadata tracking (Task D)
 * - Global kill-switch integration (Task E)
 * 
 * This service orchestrates the campaign queue and worker services.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN CREATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new campaign with full validation
 * @param {ObjectId} workspaceId 
 * @param {Object} campaignData 
 * @param {ObjectId} userId 
 */
async function createCampaign(workspaceId, campaignData, userId) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }
  
  // Validate campaign data
  await validateCampaignCreation(workspace, campaignData);
  
  // Get template for snapshot
  const template = await Template.findById(campaignData.template);
  
  // Resolve initial recipient count
  let recipientCount = 0;
  if (campaignData.contacts && campaignData.contacts.length > 0) {
    recipientCount = campaignData.contacts.length;
  } else if (campaignData.recipientFilter) {
    const filter = { workspace: workspaceId, optedOut: { $ne: true } };
    if (campaignData.recipientFilter.tags?.length > 0) {
      filter.tags = { $in: campaignData.recipientFilter.tags };
    }
    recipientCount = await Contact.countDocuments(filter);
  }
  
  // Create campaign with audit entry
  const campaign = await Campaign.create({
    workspace: workspaceId,
    name: campaignData.name,
    description: campaignData.description,
    campaignType: campaignData.scheduledAt ? 'scheduled' : 'one-time',
    template: campaignData.template,
    templateSnapshot: {
      name: template.name,
      category: template.category,
      language: template.language || 'en',
      variables: template.variables || [],
      headerType: template.headerType,
      bodyText: template.bodyText
    },
    variableMapping: campaignData.variableMapping || {},
    contacts: campaignData.contacts || [],
    recipientFilter: campaignData.recipientFilter,
    status: campaignData.scheduledAt ? 'SCHEDULED' : 'DRAFT',
    scheduledAt: campaignData.scheduledAt,
    totals: {
      totalRecipients: recipientCount,
      queued: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0
    },
    totalContacts: recipientCount,
    createdBy: userId,
    // Initialize audit (Task D)
    audit: {
      history: [{
        action: 'CREATED',
        by: userId,
        at: new Date(),
        systemInitiated: false
      }]
    }
  });
  
  // If scheduled, enqueue for future execution
  if (campaignData.scheduledAt) {
    await scheduleCampaign(campaign._id, workspaceId, campaignData.scheduledAt);
  }
  
  return campaign;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN START (Hardened with Tasks A, C, E)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start campaign execution with safety guarantees
 * 
 * HARDENING:
 * - Task A: Acquire execution lock to prevent duplicate starts
 * - Task C: Run preflight validation before execution
 * - Task D: Add audit entry
 * - Task E: Check global kill-switch and workspace safety
 * 
 * @param {ObjectId} campaignId 
 * @param {ObjectId} workspaceId 
 * @param {ObjectId} userId 
 */
async function startCampaign(campaignId, workspaceId, userId) {
  // ══════════════════════════════════════════════════════════════════════════
  // TASK E: Check global kill-switch first
  // ══════════════════════════════════════════════════════════════════════════
  const globalKillSwitch = await isGlobalKillSwitchActive();
  if (globalKillSwitch.active) {
    throw new Error(`KILL_SWITCH_ACTIVE: Global campaign kill-switch is active. Reason: ${globalKillSwitch.reason}`);
  }
  
  // Check workspace safety (quality, tier, account status)
  const workspaceSafety = await isWorkspaceSafeForCampaigns(workspaceId);
  if (!workspaceSafety.safe) {
    throw new Error(`WORKSPACE_UNSAFE: ${workspaceSafety.reason}`);
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // TASK A: Acquire execution lock to prevent duplicate starts
  // ══════════════════════════════════════════════════════════════════════════
  const lockResult = await acquireCampaignLock(campaignId, { ownerId: userId?.toString() || process.pid.toString() });
  
  if (!lockResult.acquired) {
    if (lockResult.reason === 'LOCK_ALREADY_HELD') {
      throw new Error(`CAMPAIGN_ALREADY_RUNNING: Campaign is already being executed. Started by: ${lockResult.existingOwner?.ownerId || 'unknown'} at ${lockResult.existingOwner?.acquiredAt || 'unknown'}`);
    }
    throw new Error(`LOCK_ERROR: Could not acquire execution lock. ${lockResult.error || lockResult.reason}`);
  }
  
  try {
    const campaign = await Campaign.findOne({ _id: campaignId, workspace: workspaceId })
      .populate('template');
    
    if (!campaign) {
      // Release lock on error
      await releaseCampaignLock(campaignId, { force: true });
      throw new Error('CAMPAIGN_NOT_FOUND');
    }
    
    if (!campaign.canStart()) {
      // Release lock on error
      await releaseCampaignLock(campaignId, { force: true });
      throw new Error(`INVALID_STATUS: Campaign status is ${campaign.status}`);
    }
    
    // ══════════════════════════════════════════════════════════════════════════
    // TASK C: Run preflight validation
    // ══════════════════════════════════════════════════════════════════════════
    const preflight = await validateCampaignExecution(campaignId);
    
    if (!preflight.valid) {
      // Release lock on validation failure
      await releaseCampaignLock(campaignId, { force: true });
      
      const errorMessages = preflight.errors.map(e => `${e.code}: ${e.message}`).join('; ');
      throw new Error(`PREFLIGHT_FAILED: ${errorMessages}`);
    }
    
    // Log warnings but don't block
    if (preflight.warnings.length > 0) {
      console.log(`[CampaignExecution] Warnings for campaign ${campaignId}:`, preflight.warnings);
    }
    
    // Basic validation (legacy - kept for compatibility)
    const validation = await validateCampaignStart(campaign);
    if (!validation.valid) {
      await releaseCampaignLock(campaignId, { force: true });
      throw new Error(`${validation.reason}: ${validation.message}`);
    }
    
    // Update status to indicate running
    campaign.status = 'RUNNING';
    campaign.startedAt = new Date();
    campaign.execution.startedBy = userId;
    
    // ══════════════════════════════════════════════════════════════════════════
    // TASK D: Add audit entry
    // ══════════════════════════════════════════════════════════════════════════
    await campaign.save();
    await Campaign.addAuditEntry(campaignId, 'STARTED', { userId, reason: 'Manual start' });
    
    // Enqueue campaign for processing
    const job = await enqueueCampaign(campaignId, workspaceId);
    
    return {
      campaign,
      jobId: job.id,
      preflight: {
        estimates: preflight.estimates,
        warnings: preflight.warnings
      },
      message: 'Campaign started successfully'
    };
  } catch (error) {
    // Release lock on any error (except if already released)
    if (!error.message.includes('CAMPAIGN_NOT_FOUND') && 
        !error.message.includes('INVALID_STATUS') &&
        !error.message.includes('PREFLIGHT_FAILED')) {
      await releaseCampaignLock(campaignId, { force: true });
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN PAUSE (Hardened with Task D)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pause a running campaign
 * 
 * HARDENING:
 * - Task A: Release execution lock
 * - Task D: Add audit entry
 * 
 * @param {ObjectId} campaignId 
 * @param {ObjectId} workspaceId 
 * @param {ObjectId} userId 
 * @param {String} reason 
 */
async function pauseCampaign(campaignId, workspaceId, userId, reason = 'USER_PAUSED') {
  const campaign = await Campaign.findOne({ _id: campaignId, workspace: workspaceId });
  
  if (!campaign) {
    throw new Error('CAMPAIGN_NOT_FOUND');
  }
  
  if (!campaign.canPause()) {
    throw new Error(`INVALID_STATUS: Campaign status is ${campaign.status}`);
  }
  
  // Remove pending jobs from queue
  const removedJobs = await pauseCampaignJobs(campaignId);
  
  // Update all pending batches to PAUSED (not COMPLETED - Task B finality)
  await CampaignBatch.updateMany(
    { campaign: campaignId, status: { $in: ['PENDING', 'QUEUED'] } },
    { $set: { status: 'PAUSED' } }
  );
  
  // Update campaign
  campaign.status = 'PAUSED';
  campaign.pausedReason = reason;
  campaign.pausedAt = new Date();
  campaign.execution.pausedBy = userId;
  await campaign.save();
  
  // ══════════════════════════════════════════════════════════════════════════
  // TASK D: Add audit entry
  // ══════════════════════════════════════════════════════════════════════════
  await Campaign.addAuditEntry(campaignId, 'PAUSED', { 
    userId, 
    reason, 
    systemInitiated: reason !== 'USER_PAUSED' 
  });
  
  // ══════════════════════════════════════════════════════════════════════════
  // TASK A: Release execution lock
  // ══════════════════════════════════════════════════════════════════════════
  await releaseCampaignLock(campaignId, { force: true });
  
  return {
    campaign,
    removedJobs,
    message: 'Campaign paused successfully'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN RESUME (Hardened with Tasks A, B, D, E)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resume a paused campaign
 * 
 * HARDENING:
 * - Task A: Acquire execution lock
 * - Task B: Only resume PENDING/FAILED/PAUSED batches (NEVER COMPLETED)
 * - Task D: Add audit entry
 * - Task E: Check global kill-switch and workspace safety
 * 
 * @param {ObjectId} campaignId 
 * @param {ObjectId} workspaceId 
 * @param {ObjectId} userId 
 */
async function resumeCampaign(campaignId, workspaceId, userId) {
  // ══════════════════════════════════════════════════════════════════════════
  // TASK E: Check global kill-switch first
  // ══════════════════════════════════════════════════════════════════════════
  const globalKillSwitch = await isGlobalKillSwitchActive();
  if (globalKillSwitch.active) {
    throw new Error(`KILL_SWITCH_ACTIVE: Global campaign kill-switch is active. Reason: ${globalKillSwitch.reason}`);
  }
  
  // Check workspace safety
  const workspaceSafety = await isWorkspaceSafeForCampaigns(workspaceId);
  if (!workspaceSafety.safe) {
    throw new Error(`WORKSPACE_UNSAFE: ${workspaceSafety.reason}`);
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // TASK A: Acquire execution lock
  // ══════════════════════════════════════════════════════════════════════════
  const lockResult = await acquireCampaignLock(campaignId, { ownerId: userId?.toString() || process.pid.toString() });
  
  if (!lockResult.acquired) {
    throw new Error(`CAMPAIGN_LOCK_FAILED: ${lockResult.reason}. ${lockResult.existingOwner ? `Already running since ${lockResult.existingOwner.acquiredAt}` : ''}`);
  }
  
  try {
    const campaign = await Campaign.findOne({ _id: campaignId, workspace: workspaceId })
      .populate('template');
    
    if (!campaign) {
      await releaseCampaignLock(campaignId, { force: true });
      throw new Error('CAMPAIGN_NOT_FOUND');
    }
    
    if (!campaign.canResume()) {
      await releaseCampaignLock(campaignId, { force: true });
      throw new Error(`INVALID_STATUS: Campaign status is ${campaign.status}`);
    }
    
    // Validate before resuming
    const validation = await validateCampaignStart(campaign);
    if (!validation.valid) {
      await releaseCampaignLock(campaignId, { force: true });
      throw new Error(`${validation.reason}: ${validation.message}`);
    }
    
    // ══════════════════════════════════════════════════════════════════════════
    // TASK B: Get ONLY resumable batches (NEVER include COMPLETED)
    // CRITICAL: COMPLETED batches must NEVER be re-enqueued
    // ══════════════════════════════════════════════════════════════════════════
    const resumableBatches = await getResumableBatches(campaignId);
    
    if (resumableBatches.length === 0) {
      // Check if there are any unsent messages
      const unsentCount = await CampaignMessage.countDocuments({
        campaign: campaignId,
        status: { $in: ['queued', 'pending'] }
      });
      
      if (unsentCount === 0) {
        // Campaign is actually complete - release lock and mark complete
        await releaseCampaignLock(campaignId, { force: true });
        
        campaign.status = 'COMPLETED';
        campaign.completedAt = new Date();
        await campaign.save();
        
        await Campaign.addAuditEntry(campaignId, 'COMPLETED', { 
          userId, 
          reason: 'All batches completed on resume check' 
        });
        
        return {
          campaign,
          message: 'Campaign already complete - no pending batches or messages'
        };
      }
    }
    
    // Update ONLY resumable batches to PENDING (Task B - finality guarantee)
    await CampaignBatch.updateMany(
      { 
        campaign: campaignId, 
        status: { $in: ['PAUSED', 'FAILED'] } // NOT: COMPLETED, PROCESSING
      },
      { $set: { status: 'PENDING' } }
    );
    
    // Clear system pause flag if it was system-paused
    const wasSystemPaused = campaign.audit?.systemPaused;
    
    // Update campaign
    campaign.status = 'RUNNING';
    campaign.pausedReason = null;
    campaign.pausedAt = null;
    campaign.execution.resumedBy = userId;
    campaign.execution.lastResumedAt = new Date();
    campaign.execution.resumeCount = (campaign.execution.resumeCount || 0) + 1;
    
    // Clear system pause flag
    if (wasSystemPaused && campaign.audit) {
      campaign.audit.systemPaused = false;
    }
    
    await campaign.save();
    
    // ══════════════════════════════════════════════════════════════════════════
    // TASK D: Add audit entry
    // ══════════════════════════════════════════════════════════════════════════
    await Campaign.addAuditEntry(campaignId, 'RESUMED', { 
      userId, 
      reason: wasSystemPaused ? 'Resumed after system pause' : 'Manual resume'
    });
    
    // Re-enqueue ONLY resumable batches (Task B - idempotency)
    const { enqueueBatches } = require('./campaignQueueService');
    
    // Get full batch documents for enqueueing
    const batchesToEnqueue = await CampaignBatch.find({
      campaign: campaignId,
      status: 'PENDING'
    }).sort({ batchIndex: 1 });
    
    await enqueueBatches(batchesToEnqueue, 2000);
    
    return {
      campaign,
      resumedBatches: batchesToEnqueue.length,
      skippedCompletedBatches: (campaign.batching?.completedBatches || 0),
      message: 'Campaign resumed successfully'
    };
  } catch (error) {
    // Release lock on any error
    await releaseCampaignLock(campaignId, { force: true });
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN PROGRESS & STATS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get detailed campaign progress
 * @param {ObjectId} campaignId 
 * @param {ObjectId} workspaceId 
 */
async function getCampaignProgress(campaignId, workspaceId) {
  const campaign = await Campaign.findOne({ _id: campaignId, workspace: workspaceId })
    .populate('template', 'name category status')
    .lean();
  
  if (!campaign) {
    throw new Error('CAMPAIGN_NOT_FOUND');
  }
  
  // Get batch stats
  const batchStats = await CampaignBatch.getCampaignBatchStats(campaignId);
  
  // Get job queue status
  const queueStatus = await getCampaignJobsStatus(campaignId);
  
  // Calculate progress
  const totalRecipients = campaign.totals?.totalRecipients || campaign.totalContacts || 0;
  const processed = (campaign.totals?.sent || campaign.sentCount || 0) + 
                   (campaign.totals?.failed || campaign.failedCount || 0);
  const progressPercent = totalRecipients > 0 ? Math.round((processed / totalRecipients) * 100) : 0;
  
  // Calculate rates
  const sent = campaign.totals?.sent || campaign.sentCount || 0;
  const delivered = campaign.totals?.delivered || campaign.deliveredCount || 0;
  const read = campaign.totals?.read || campaign.readCount || 0;
  const failed = campaign.totals?.failed || campaign.failedCount || 0;
  
  const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
  const readRate = delivered > 0 ? Math.round((read / delivered) * 100) : 0;
  const failureRate = (sent + failed) > 0 ? Math.round((failed / (sent + failed)) * 100) : 0;
  
  return {
    campaign,
    progress: {
      totalRecipients,
      processed,
      remaining: totalRecipients - processed,
      progressPercent
    },
    totals: {
      sent,
      delivered,
      read,
      failed,
      replied: campaign.totals?.replied || campaign.repliedCount || 0
    },
    rates: {
      deliveryRate,
      readRate,
      failureRate
    },
    batching: {
      totalBatches: batchStats.totalBatches,
      completedBatches: batchStats.completedBatches,
      failedBatches: batchStats.failedBatches,
      processingBatches: batchStats.processingBatches,
      pendingBatches: batchStats.pendingBatches
    },
    queue: queueStatus,
    timing: {
      createdAt: campaign.createdAt,
      scheduledAt: campaign.scheduledAt,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      pausedAt: campaign.pausedAt
    }
  };
}

/**
 * Get campaign summary for completed campaigns
 */
async function getCampaignSummary(campaignId, workspaceId) {
  const campaign = await Campaign.findOne({ _id: campaignId, workspace: workspaceId })
    .populate('template', 'name category')
    .populate('createdBy', 'email name')
    .lean();
  
  if (!campaign) {
    throw new Error('CAMPAIGN_NOT_FOUND');
  }
  
  const totalRecipients = campaign.totals?.totalRecipients || campaign.totalContacts;
  const sent = campaign.totals?.sent || campaign.sentCount || 0;
  const delivered = campaign.totals?.delivered || campaign.deliveredCount || 0;
  const read = campaign.totals?.read || campaign.readCount || 0;
  const failed = campaign.totals?.failed || campaign.failedCount || 0;
  const replied = campaign.totals?.replied || campaign.repliedCount || 0;
  
  // Calculate duration
  let durationMs = 0;
  if (campaign.startedAt) {
    const endTime = campaign.completedAt || campaign.pausedAt || new Date();
    durationMs = new Date(endTime).getTime() - new Date(campaign.startedAt).getTime();
  }
  
  // Get error breakdown
  const errorBreakdown = await CampaignMessage.aggregate([
    { $match: { campaign: campaign._id, status: 'failed' } },
    { $group: { _id: '$lastError', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  
  return {
    campaign: {
      id: campaign._id,
      name: campaign.name,
      status: campaign.status,
      template: campaign.template,
      createdBy: campaign.createdBy
    },
    summary: {
      totalRecipients,
      sent,
      delivered,
      read,
      failed,
      replied
    },
    rates: {
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
      readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
      replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
      failureRate: totalRecipients > 0 ? Math.round((failed / totalRecipients) * 100) : 0
    },
    timing: {
      createdAt: campaign.createdAt,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      durationMs,
      durationFormatted: formatDuration(durationMs)
    },
    errors: {
      pausedReason: campaign.pausedReason,
      breakdown: errorBreakdown.map(e => ({ error: e._id, count: e.count }))
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE LISTING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get campaign messages with pagination
 */
async function getCampaignMessages(campaignId, workspaceId, options = {}) {
  const { page = 1, limit = 50, status, search } = options;
  
  const query = { campaign: campaignId, workspace: workspaceId };
  
  if (status) {
    query.status = status;
  }
  
  if (search) {
    // Search by contact phone
    const contacts = await Contact.find({
      workspace: workspaceId,
      phone: { $regex: search, $options: 'i' }
    }).select('_id');
    
    query.contact = { $in: contacts.map(c => c._id) };
  }
  
  const total = await CampaignMessage.countDocuments(query);
  
  const messages = await CampaignMessage.find(query)
    .populate('contact', 'phone name')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  
  return {
    messages,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format duration to human-readable string
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN COMPLETION HANDLER (Hardened - Task A, D)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark campaign as completed and release resources
 * Called by worker when all batches are processed
 * 
 * HARDENING:
 * - Task A: Release execution lock
 * - Task D: Add audit entry
 * 
 * @param {String} campaignId - Campaign ID
 * @param {String} reason - Completion reason
 */
async function completeCampaign(campaignId, reason = 'All batches processed') {
  try {
    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign) {
      console.error(`[CampaignExecution] Cannot complete - campaign not found: ${campaignId}`);
      return { success: false, error: 'Campaign not found' };
    }
    
    // Only complete if still running
    if (campaign.status !== 'RUNNING') {
      console.log(`[CampaignExecution] Campaign ${campaignId} already in final state: ${campaign.status}`);
      return { success: false, error: `Campaign status is ${campaign.status}` };
    }
    
    // Update campaign status
    campaign.status = 'COMPLETED';
    campaign.completedAt = new Date();
    await campaign.save();
    
    // Add audit entry (Task D)
    await Campaign.addAuditEntry(campaignId, 'COMPLETED', { reason });
    
    // Release execution lock (Task A)
    await releaseCampaignLock(campaignId, { force: true });
    
    console.log(`[CampaignExecution] Campaign completed: ${campaignId}`);
    
    return { success: true, campaign };
  } catch (error) {
    console.error(`[CampaignExecution] Error completing campaign ${campaignId}:`, error);
    
    // Always try to release lock on completion
    await releaseCampaignLock(campaignId, { force: true });
    
    return { success: false, error: error.message };
  }
}

/**
 * Mark campaign as failed and release resources
 * Called by worker when campaign fails critically
 * 
 * @param {String} campaignId - Campaign ID
 * @param {String} reason - Failure reason
 */
async function failCampaign(campaignId, reason) {
  try {
    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }
    
    // Update campaign status
    campaign.status = 'FAILED';
    campaign.pausedReason = reason;
    campaign.completedAt = new Date();
    await campaign.save();
    
    // Add audit entry (Task D)
    await Campaign.addAuditEntry(campaignId, 'FAILED', { reason, systemInitiated: true });
    
    // Release execution lock (Task A)
    await releaseCampaignLock(campaignId, { force: true });
    
    console.log(`[CampaignExecution] Campaign failed: ${campaignId}, reason: ${reason}`);
    
    return { success: true, campaign };
  } catch (error) {
    console.error(`[CampaignExecution] Error failing campaign ${campaignId}:`, error);
    
    // Always try to release lock
    await releaseCampaignLock(campaignId, { force: true });
    
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Campaign lifecycle
  createCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  completeCampaign,
  failCampaign,
  
  // Progress & stats
  getCampaignProgress,
  getCampaignSummary,
  getCampaignMessages,
  
  // Re-export for convenience
  validateCampaignExecution: require('./campaignPreflightService').validateCampaignExecution
};
