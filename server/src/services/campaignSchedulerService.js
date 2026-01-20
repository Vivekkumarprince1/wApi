const cron = require('node-cron');
const Campaign = require('../models/Campaign');
const { enqueueCampaign } = require('./campaignQueueService');
const { validateCampaignStart } = require('./campaignValidationService');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN SCHEDULER SERVICE - Stage 3 Implementation
 * 
 * Handles scheduled campaign execution:
 * - Checks for campaigns that need to start
 * - Validates before starting
 * - Enqueues for execution
 * 
 * Runs every minute to check for scheduled campaigns.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

let schedulerJob = null;

/**
 * Start the campaign scheduler
 * Runs every minute to check for campaigns that should start
 */
function startScheduler() {
  // Run every minute
  schedulerJob = cron.schedule('* * * * *', async () => {
    try {
      await processScheduledCampaigns();
    } catch (err) {
      console.error('[CampaignScheduler] Error processing scheduled campaigns:', err.message);
    }
  });
  
  console.log('[CampaignScheduler] Campaign scheduler started (runs every minute)');
}

/**
 * Stop the campaign scheduler
 */
function stopScheduler() {
  if (schedulerJob) {
    schedulerJob.stop();
    console.log('[CampaignScheduler] Campaign scheduler stopped');
  }
}

/**
 * Process campaigns that are scheduled to run
 */
async function processScheduledCampaigns() {
  const now = new Date();
  
  // Find campaigns scheduled to start within the last 2 minutes
  // (to account for any timing delays)
  const startWindow = new Date(now.getTime() - 2 * 60 * 1000);
  
  const scheduledCampaigns = await Campaign.find({
    status: { $in: ['SCHEDULED', 'queued'] },
    $or: [
      { scheduledAt: { $lte: now, $gte: startWindow } },
      { scheduleAt: { $lte: now, $gte: startWindow } } // Legacy field
    ]
  }).populate('template workspace');
  
  if (scheduledCampaigns.length === 0) {
    return;
  }
  
  console.log(`[CampaignScheduler] Found ${scheduledCampaigns.length} campaigns to start`);
  
  for (const campaign of scheduledCampaigns) {
    try {
      // Validate campaign can still start
      const validation = await validateCampaignStart(campaign);
      
      if (!validation.valid) {
        // Mark as failed if validation fails
        campaign.status = 'FAILED';
        campaign.pausedReason = validation.reason;
        campaign.completedAt = new Date();
        await campaign.save();
        
        console.log(`[CampaignScheduler] Campaign ${campaign._id} validation failed: ${validation.reason}`);
        continue;
      }
      
      // Enqueue the campaign
      await enqueueCampaign(campaign._id, campaign.workspace);
      
      console.log(`[CampaignScheduler] Campaign ${campaign._id} enqueued for execution`);
    } catch (err) {
      console.error(`[CampaignScheduler] Failed to start campaign ${campaign._id}:`, err.message);
      
      // Mark as failed
      campaign.status = 'FAILED';
      campaign.pausedReason = 'SCHEDULER_ERROR';
      campaign.failureTracking = campaign.failureTracking || {};
      campaign.failureTracking.lastFailureAt = new Date();
      campaign.failureTracking.lastFailureError = err.message;
      await campaign.save();
    }
  }
}

/**
 * Get upcoming scheduled campaigns
 * @param {ObjectId} workspaceId - Optional workspace filter
 * @param {Number} hours - Look ahead hours (default 24)
 */
async function getUpcomingCampaigns(workspaceId = null, hours = 24) {
  const now = new Date();
  const endWindow = new Date(now.getTime() + hours * 60 * 60 * 1000);
  
  const query = {
    status: { $in: ['SCHEDULED', 'queued'] },
    $or: [
      { scheduledAt: { $gte: now, $lte: endWindow } },
      { scheduleAt: { $gte: now, $lte: endWindow } }
    ]
  };
  
  if (workspaceId) {
    query.workspace = workspaceId;
  }
  
  return Campaign.find(query)
    .populate('template', 'name category')
    .sort({ scheduledAt: 1, scheduleAt: 1 })
    .lean();
}

/**
 * Reschedule a campaign
 * @param {ObjectId} campaignId 
 * @param {Date} newScheduledAt 
 */
async function rescheduleCampaign(campaignId, newScheduledAt) {
  const campaign = await Campaign.findById(campaignId);
  
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  
  if (!['DRAFT', 'SCHEDULED', 'draft', 'queued'].includes(campaign.status)) {
    throw new Error('Can only reschedule draft or scheduled campaigns');
  }
  
  campaign.scheduledAt = newScheduledAt;
  campaign.scheduleAt = newScheduledAt; // Legacy field
  campaign.status = 'SCHEDULED';
  campaign.campaignType = 'scheduled';
  
  await campaign.save();
  
  return campaign;
}

/**
 * Cancel a scheduled campaign
 * @param {ObjectId} campaignId 
 */
async function cancelScheduledCampaign(campaignId) {
  const campaign = await Campaign.findById(campaignId);
  
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  
  if (!['SCHEDULED', 'queued'].includes(campaign.status)) {
    throw new Error('Can only cancel scheduled campaigns');
  }
  
  campaign.status = 'DRAFT';
  campaign.scheduledAt = null;
  campaign.scheduleAt = null;
  campaign.campaignType = 'one-time';
  
  await campaign.save();
  
  return campaign;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  startScheduler,
  stopScheduler,
  processScheduledCampaigns,
  getUpcomingCampaigns,
  rescheduleCampaign,
  cancelScheduledCampaign
};
