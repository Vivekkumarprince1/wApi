const { Worker } = require('bullmq');
const { connection, JOB_TYPES, enqueueBatches, enqueueCampaignCheck } = require('./campaignQueueService');
const { 
  checkCampaignRateLimit, 
  recordRateLimitHit, 
  clearBackoff, 
  shouldWaitForBackoff,
  trackCampaignError,
  trackCampaignSuccess,
  handleMetaError
} = require('./campaignRateLimiter');
const templateSendingService = require('./templateSendingService');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN WORKER SERVICE - Stage 3 Implementation
 * 
 * BullMQ workers for processing campaign jobs:
 * - Campaign initialization
 * - Batch processing
 * - Completion checks
 * 
 * Features:
 * - Rate-limited sending
 * - Exponential backoff on errors
 * - Auto-pause on critical failures
 * - Real-time status updates
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// BATCH PROCESSING CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_CONFIG = {
  BATCH_SIZE: 50,                    // Recipients per batch
  DELAY_BETWEEN_MESSAGES_MS: 50,     // 50ms between messages in batch
  DELAY_BETWEEN_BATCHES_MS: 2000,    // 2s between batch starts
  MAX_RETRIES_PER_MESSAGE: 3,
  FAILURE_THRESHOLD_PERCENT: 30      // Pause if >30% failures
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKER: CAMPAIGN START
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process campaign start job
 * - Validates campaign and template
 * - Resolves recipients
 * - Creates batches
 * - Enqueues batch jobs
 */
async function processCampaignStart(job) {
  const { campaignId, workspaceId } = job.data;
  
  const Campaign = require('../models/Campaign');
  const CampaignBatch = require('../models/CampaignBatch');
  const Template = require('../models/Template');
  const Contact = require('../models/Contact');
  const Workspace = require('../models/Workspace');
  
  console.log(`[CampaignWorker] Starting campaign: ${campaignId}`);
  
  const campaign = await Campaign.findById(campaignId).populate('template');
  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }
  
  // Check campaign can start
  if (!['DRAFT', 'SCHEDULED', 'draft', 'queued'].includes(campaign.status)) {
    console.log(`[CampaignWorker] Campaign ${campaignId} cannot start, status: ${campaign.status}`);
    return { status: 'skipped', reason: 'Invalid campaign status' };
  }
  
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }
  
  // Validate template is still APPROVED
  const template = await Template.findById(campaign.template);
  if (!template || template.status !== 'APPROVED') {
    campaign.status = 'FAILED';
    campaign.pausedReason = 'TEMPLATE_REVOKED';
    campaign.completedAt = new Date();
    await campaign.save();
    throw new Error('Template is not approved');
  }
  
  // Validate workspace connection (BSP-aware)
  const isBspConnected = typeof workspace.isBspConnected === 'function'
    ? workspace.isBspConnected()
    : false;
  if (!isBspConnected) {
    campaign.status = 'FAILED';
    campaign.pausedReason = 'PHONE_DISCONNECTED';
    campaign.completedAt = new Date();
    await campaign.save();
    throw new Error('WhatsApp not connected');
  }
  
  // Resolve recipients
  let contacts = [];
  
  if (campaign.contacts && campaign.contacts.length > 0) {
    // Static contact list
    contacts = await Contact.find({
      _id: { $in: campaign.contacts },
      workspace: workspaceId,
      optedOut: { $ne: true }
    }).select('_id phone name');
  } else if (campaign.recipientFilter) {
    // Dynamic filter-based
    const filter = { workspace: workspaceId, optedOut: { $ne: true } };
    
    if (campaign.recipientFilter.type === 'tags' && campaign.recipientFilter.tags?.length > 0) {
      filter.tags = { $in: campaign.recipientFilter.tags };
    } else if (campaign.recipientFilter.customFilter) {
      Object.assign(filter, campaign.recipientFilter.customFilter);
    }
    
    contacts = await Contact.find(filter).select('_id phone name').limit(100000);
  }
  
  if (contacts.length === 0) {
    campaign.status = 'FAILED';
    campaign.pausedReason = null;
    campaign.completedAt = new Date();
    await campaign.save();
    throw new Error('No valid recipients found');
  }
  
  console.log(`[CampaignWorker] Resolved ${contacts.length} recipients for campaign ${campaignId}`);
  
  // Update campaign status to RUNNING
  campaign.status = 'RUNNING';
  campaign.startedAt = new Date();
  campaign.totals.totalRecipients = contacts.length;
  campaign.totalContacts = contacts.length;
  campaign.batching.batchSize = BATCH_CONFIG.BATCH_SIZE;
  campaign.batching.totalBatches = Math.ceil(contacts.length / BATCH_CONFIG.BATCH_SIZE);
  
  // Store template snapshot
  campaign.templateSnapshot = {
    name: template.name,
    category: template.category,
    language: template.language || 'en',
    variables: template.variables || [],
    headerType: template.headerType,
    bodyText: template.bodyText
  };
  
  await campaign.save();
  
  // Create batches
  const batches = await CampaignBatch.createBatches(
    campaignId,
    workspaceId,
    contacts,
    template._id,
    template.name,
    campaign.variableMapping || {},
    BATCH_CONFIG.BATCH_SIZE
  );
  
  console.log(`[CampaignWorker] Created ${batches.length} batches for campaign ${campaignId}`);
  
  // Enqueue batch jobs with staggered delays
  await enqueueBatches(batches, BATCH_CONFIG.DELAY_BETWEEN_BATCHES_MS);
  
  // Schedule completion check
  const estimatedDurationMs = batches.length * BATCH_CONFIG.DELAY_BETWEEN_BATCHES_MS + 
                              contacts.length * BATCH_CONFIG.DELAY_BETWEEN_MESSAGES_MS;
  await enqueueCampaignCheck(campaignId, workspaceId, estimatedDurationMs + 30000);
  
  return {
    status: 'started',
    campaignId,
    totalRecipients: contacts.length,
    totalBatches: batches.length,
    estimatedDurationMs
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKER: BATCH PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process a single batch of recipients
 */
async function processBatch(job) {
  const { batchId, campaignId, workspaceId } = job.data;
  
  const Campaign = require('../models/Campaign');
  const CampaignBatch = require('../models/CampaignBatch');
  const CampaignMessage = require('../models/CampaignMessage');
  const Contact = require('../models/Contact');
  const Template = require('../models/Template');
  const Workspace = require('../models/Workspace');
  const Message = require('../models/Message');
  
  console.log(`[CampaignWorker] Processing batch: ${batchId}`);
  
  // Load batch
  const batch = await CampaignBatch.findById(batchId);
  if (!batch) {
    throw new Error(`Batch not found: ${batchId}`);
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // TASK B: Batch finality check - COMPLETED batches MUST NOT be re-processed
  // ══════════════════════════════════════════════════════════════════════════
  if (batch.status === 'COMPLETED') {
    console.log(`[CampaignWorker] Batch ${batchId} already COMPLETED - skipping (idempotency)`);
    return { status: 'already_completed', batchId, skipped: true };
  }
  
  // Also skip if already processing (prevent duplicate workers)
  if (batch.status === 'PROCESSING') {
    const processingTime = Date.now() - new Date(batch.startedAt).getTime();
    // If processing for more than 10 minutes, something is wrong - allow retry
    if (processingTime < 10 * 60 * 1000) {
      console.log(`[CampaignWorker] Batch ${batchId} already PROCESSING - skipping`);
      return { status: 'already_processing', batchId, skipped: true };
    }
    console.log(`[CampaignWorker] Batch ${batchId} stuck in PROCESSING - retrying`);
  }
  
  // Load campaign and check if still running
  const campaign = await Campaign.findById(campaignId);
  if (!campaign || !['RUNNING', 'sending'].includes(campaign.status)) {
    batch.status = 'PAUSED';
    await batch.save();
    return { status: 'campaign_not_running', batchId };
  }
  
  // Load workspace
  const workspace = await Workspace.findById(workspaceId);
  const isBspConnected = workspace && typeof workspace.isBspConnected === 'function'
    ? workspace.isBspConnected()
    : false;
  if (!workspace || !isBspConnected) {
    await pauseCampaignWithReason(campaign, 'PHONE_DISCONNECTED');
    throw new Error('Workspace is not BSP-connected');
  }
  
  const phoneNumberId = workspace.getPhoneNumberId?.();
  if (!phoneNumberId) {
    await pauseCampaignWithReason(campaign, 'PHONE_DISCONNECTED');
    throw new Error('WhatsApp phone not configured');
  }
  
  // Load template
  const template = await Template.findById(batch.templateId);
  if (!template || template.status !== 'APPROVED') {
    await pauseCampaignWithReason(campaign, 'TEMPLATE_REVOKED');
    throw new Error('Template not approved');
  }
  
  // Check backoff state
  const backoffState = await shouldWaitForBackoff(campaignId);
  if (backoffState.shouldWait) {
    // Re-queue with delay
    throw new Error(`BACKOFF_WAIT:${backoffState.waitMs}`);
  }
  
  // Mark batch as processing
  batch.status = 'PROCESSING';
  batch.startedAt = new Date();
  batch.attempts += 1;
  await batch.save();
  
  // Process each recipient
  const results = {
    sent: 0,
    failed: 0,
    errors: []
  };
  
  const pendingRecipients = batch.recipients.filter(
    r => ['pending', 'queued'].includes(r.status)
  );
  
  for (const recipient of pendingRecipients) {
    // Check campaign is still running (could be paused mid-batch)
    const freshCampaign = await Campaign.findById(campaignId).select('status');
    if (!['RUNNING', 'sending'].includes(freshCampaign.status)) {
      console.log(`[CampaignWorker] Campaign ${campaignId} paused mid-batch`);
      break;
    }
    
    // Rate limit check
    const rateLimitCheck = await checkCampaignRateLimit(workspaceId, phoneNumberId);
    if (!rateLimitCheck.allowed) {
      console.log(`[CampaignWorker] Rate limited, backing off...`);
      await recordRateLimitHit(campaignId, 'RATE_LIMIT', rateLimitCheck.level);
      
      // Delay and retry this batch
      throw new Error(`RATE_LIMITED:${rateLimitCheck.retryAfter * 1000}`);
    }
    
    try {
      // Get contact for variable resolution
      const contact = await Contact.findById(recipient.contactId);
      if (!contact) {
        recipient.status = 'failed';
        recipient.error = 'Contact not found';
        results.failed++;
        continue;
      }
      
      // Check idempotency - already sent?
      const existingMessage = await CampaignMessage.findOne({
        campaign: campaignId,
        contact: recipient.contactId,
        status: { $in: ['sent', 'delivered', 'read'] }
      });
      
      if (existingMessage) {
        recipient.status = 'sent';
        recipient.messageId = existingMessage.whatsappMessageId;
        continue;
      }
      
      // Build template parameters
      const templateVars = buildTemplateParams(template, batch.variableMapping, contact);
      
      // Send message via template service (BSP centralized token + approval checks)
      const result = await templateSendingService.sendTemplate({
        workspaceId,
        templateId: template._id,
        to: contact.phone,
        variables: templateVars,
        contactId: recipient.contactId,
        meta: {
          campaignId,
          batchId: batch._id,
          batchIndex: batch.batchIndex
        }
      });
      
      // Update recipient status
      recipient.status = 'sent';
      recipient.messageId = result.messageId;
      recipient.processedAt = new Date();
      results.sent++;
      
      // Create/update CampaignMessage record
      await CampaignMessage.findOneAndUpdate(
        { campaign: campaignId, contact: recipient.contactId },
        {
          $set: {
            workspace: workspaceId,
            status: 'sent',
            sentAt: new Date(),
            whatsappMessageId: result.messageId
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
      
      // Message record already logged by template service
      
      // Update campaign totals atomically
      await Campaign.findByIdAndUpdate(campaignId, {
        $inc: { 
          'totals.sent': 1,
          sentCount: 1
        }
      });
      
      // Track success (clears consecutive error counter)
      await trackCampaignSuccess(campaignId);
      await clearBackoff(campaignId);
      
    } catch (err) {
      console.error(`[CampaignWorker] Failed to send to ${recipient.phone}:`, err.message);
      
      recipient.status = 'failed';
      recipient.error = err.message;
      recipient.processedAt = new Date();
      results.failed++;
      results.errors.push({ phone: recipient.phone, error: err.message });
      
      // Update CampaignMessage
      await CampaignMessage.findOneAndUpdate(
        { campaign: campaignId, contact: recipient.contactId },
        {
          $set: {
            workspace: workspaceId,
            status: 'failed',
            failedAt: new Date(),
            lastError: err.message
          },
          $inc: { attempts: 1 },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
      
      // Update campaign totals
      await Campaign.findByIdAndUpdate(campaignId, {
        $inc: { 
          'totals.failed': 1,
          failedCount: 1
        },
        $set: {
          'failureTracking.lastFailureAt': new Date(),
          'failureTracking.lastFailureError': err.message
        }
      });
      
      // Track error and check for auto-pause
      const errorHandling = handleMetaError(err);
      const errorTracking = await trackCampaignError(campaignId, errorHandling.reason, err.message);
      
      if (errorTracking.shouldAutoPause || errorHandling.action === 'PAUSE_CAMPAIGN') {
        await pauseCampaignWithReason(campaign, errorHandling.reason);
        throw new Error(`Campaign auto-paused: ${errorHandling.reason}`);
      }
      
      // If rate limited, backoff and retry
      if (errorHandling.action === 'BACKOFF') {
        await recordRateLimitHit(campaignId, errorHandling.reason, err.message);
        throw new Error(`BACKOFF:${errorHandling.backoffMs}`);
      }
    }
    
    // Small delay between messages
    await sleep(BATCH_CONFIG.DELAY_BETWEEN_MESSAGES_MS);
  }
  
  // Update batch stats
  batch.stats.sent += results.sent;
  batch.stats.failed += results.failed;
  
  // Check if batch is complete
  const pendingCount = batch.recipients.filter(r => ['pending', 'queued'].includes(r.status)).length;
  if (pendingCount === 0) {
    batch.status = 'COMPLETED';
    batch.completedAt = new Date();
  }
  
  await batch.save();
  
  // Update campaign batch progress
  await Campaign.findByIdAndUpdate(campaignId, {
    $inc: { 'batching.completedBatches': batch.status === 'COMPLETED' ? 1 : 0 },
    $set: { 'batching.lastBatchProcessedAt': new Date() }
  });
  
  // Check for campaign completion
  await checkCampaignCompletion(campaignId);
  
  console.log(`[CampaignWorker] Batch ${batchId} complete: sent=${results.sent}, failed=${results.failed}`);
  
  return {
    status: 'completed',
    batchId,
    sent: results.sent,
    failed: results.failed
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKER: CAMPAIGN COMPLETION CHECK (Hardened - Tasks A, B, D)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if campaign is complete and update status
 * 
 * HARDENING:
 * - Task A: Release execution lock on completion
 * - Task B: Verify batch finality before marking complete
 * - Task D: Add audit entry on completion
 */
async function checkCampaignCompletion(campaignId) {
  const Campaign = require('../models/Campaign');
  const CampaignBatch = require('../models/CampaignBatch');
  const { releaseCampaignLock } = require('./campaignLockService');
  
  const campaign = await Campaign.findById(campaignId);
  if (!campaign || campaign.status !== 'RUNNING') {
    return { completed: false, reason: 'not_running' };
  }
  
  const batchStats = await CampaignBatch.getCampaignBatchStats(campaignId);
  
  // ══════════════════════════════════════════════════════════════════════════
  // TASK B: Verify batch finality - only count truly final batches
  // ══════════════════════════════════════════════════════════════════════════
  const finalBatches = batchStats.completedBatches + batchStats.failedBatches;
  
  // All batches in final state?
  if (finalBatches >= batchStats.totalBatches) {
    campaign.status = 'COMPLETED';
    campaign.completedAt = new Date();
    
    // Sync totals from batches
    campaign.totals.sent = batchStats.totalSent;
    campaign.totals.delivered = batchStats.totalDelivered;
    campaign.totals.read = batchStats.totalRead;
    campaign.totals.failed = batchStats.totalFailed;
    
    campaign.sentCount = batchStats.totalSent;
    campaign.deliveredCount = batchStats.totalDelivered;
    campaign.readCount = batchStats.totalRead;
    campaign.failedCount = batchStats.totalFailed;
    
    await campaign.save();
    
    // ══════════════════════════════════════════════════════════════════════════
    // TASK D: Add audit entry
    // ══════════════════════════════════════════════════════════════════════════
    await Campaign.addAuditEntry(campaignId, 'COMPLETED', { 
      reason: 'All batches processed',
      systemInitiated: true
    });
    
    // ══════════════════════════════════════════════════════════════════════════
    // TASK A: Release execution lock
    // ══════════════════════════════════════════════════════════════════════════
    await releaseCampaignLock(campaignId, { force: true });
    
    console.log(`[CampaignWorker] Campaign ${campaignId} completed - lock released`);
    
    return { completed: true, stats: batchStats };
  }
  
  // Check failure rate
  const totalProcessed = batchStats.totalSent + batchStats.totalFailed;
  if (totalProcessed > 0) {
    const failureRate = (batchStats.totalFailed / totalProcessed) * 100;
    
    if (failureRate >= BATCH_CONFIG.FAILURE_THRESHOLD_PERCENT && totalProcessed >= 50) {
      await pauseCampaignWithReason(campaign, 'HIGH_FAILURE_RATE');
      campaign.failureTracking.failureRate = failureRate;
      await campaign.save();
      
      console.log(`[CampaignWorker] Campaign ${campaignId} paused due to high failure rate: ${failureRate}%`);
      return { completed: false, reason: 'high_failure_rate', failureRate };
    }
  }
  
  return { completed: false, reason: 'still_processing', batchStats };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build template parameters from variable mapping
 */
function buildTemplateParams(template, variableMapping, contact) {
  if (!template.variables || template.variables.length === 0) {
    return { body: [] };
  }
  
  const bodyParams = template.variables.map(variable => {
    const contactField = variableMapping[variable];
    let value = '';
    
    if (contactField) {
      // Try direct field access
      value = contact[contactField];
      
      // Try metadata
      if (!value && contact.metadata) {
        value = contact.metadata[contactField];
      }
      
      // Try custom fields
      if (!value && contact.customFields) {
        const customField = contact.customFields.find(f => f.key === contactField);
        value = customField?.value;
      }
    }
    
    return String(value || '');
  });
  
  return { body: bodyParams };
}

/**
 * Pause campaign with specific reason (Hardened - Tasks A, D)
 * 
 * HARDENING:
 * - Task A: Release execution lock
 * - Task D: Add audit entry with system-initiated flag
 */
async function pauseCampaignWithReason(campaign, reason) {
  const Campaign = require('../models/Campaign');
  const { releaseCampaignLock } = require('./campaignLockService');
  
  campaign.status = 'PAUSED';
  campaign.pausedReason = reason;
  campaign.pausedAt = new Date();
  
  // Mark as system-paused (Task D)
  if (!campaign.audit) {
    campaign.audit = {};
  }
  campaign.audit.systemPaused = true;
  campaign.audit.lastSystemPauseReason = reason;
  campaign.audit.lastSystemPauseAt = new Date();
  
  await campaign.save();
  
  // Add audit entry (Task D)
  await Campaign.addAuditEntry(campaign._id, 'SYSTEM_PAUSED', { 
    reason,
    systemInitiated: true
  });
  
  // Release execution lock (Task A)
  await releaseCampaignLock(campaign._id, { force: true });
  
  console.log(`[CampaignWorker] Campaign ${campaign._id} paused: ${reason} - lock released`);
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKER INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

let campaignWorker;

/**
 * Start the campaign worker
 */
function startCampaignWorker() {
  campaignWorker = new Worker(
    'campaign-engine',
    async (job) => {
      console.log(`[CampaignWorker] Processing job: ${job.name} (${job.id})`);
      
      switch (job.name) {
        case JOB_TYPES.CAMPAIGN_START:
        case JOB_TYPES.SCHEDULED_START:
          return await processCampaignStart(job);
          
        case JOB_TYPES.BATCH_PROCESS:
          return await processBatch(job);
          
        case JOB_TYPES.CAMPAIGN_CHECK:
          return await checkCampaignCompletion(job.data.campaignId);
          
        default:
          console.warn(`[CampaignWorker] Unknown job type: ${job.name}`);
          return { status: 'unknown_job_type' };
      }
    },
    {
      connection,
      concurrency: 5, // Process up to 5 jobs concurrently
      limiter: {
        max: 10,
        duration: 1000 // Max 10 jobs per second
      }
    }
  );
  
  // Event handlers
  campaignWorker.on('completed', (job, result) => {
    console.log(`[CampaignWorker] Job ${job.id} completed:`, result?.status);
  });
  
  campaignWorker.on('failed', (job, err) => {
    console.error(`[CampaignWorker] Job ${job.id} failed:`, err.message);
    
    // Handle backoff errors
    if (err.message.startsWith('BACKOFF:') || err.message.startsWith('RATE_LIMITED:')) {
      const delay = parseInt(err.message.split(':')[1]) || 10000;
      console.log(`[CampaignWorker] Will retry in ${delay}ms`);
    }
  });
  
  campaignWorker.on('error', (err) => {
    console.error('[CampaignWorker] Worker error:', err.message);
  });
  
  console.log('[CampaignWorker] Campaign worker started');
  
  return campaignWorker;
}

/**
 * Stop the campaign worker gracefully
 */
async function stopCampaignWorker() {
  if (campaignWorker) {
    await campaignWorker.close();
    console.log('[CampaignWorker] Campaign worker stopped');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  startCampaignWorker,
  stopCampaignWorker,
  processCampaignStart,
  processBatch,
  checkCampaignCompletion,
  BATCH_CONFIG
};
