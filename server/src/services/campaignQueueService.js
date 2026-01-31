const { Queue, QueueScheduler, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const { redisUrl } = require('../config');

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CAMPAIGN QUEUE SERVICE - Stage 3 Implementation
 * 
 * BullMQ-based queue for campaign execution with:
 * - Separate queues for batches and individual messages
 * - Priority handling
 * - Delayed/scheduled jobs
 * - Rate limiting integration
 * 
 * Follows Interakt's production architecture for reliable delivery.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Redis connection for BullMQ (requires maxRetriesPerRequest: null)
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 10) {
      console.error('[CampaignQueue] Redis connection failed after 10 retries');
      return null;
    }
    return Math.min(times * 100, 3000);
  }
});

connection.on('error', (err) => {
  console.error('[CampaignQueue] Redis error:', err.message);
});

connection.on('connect', () => {
  console.log('[CampaignQueue] Redis connected');
});

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

// Main campaign queue - processes campaign batches
const campaignQueue = new Queue('campaign-engine', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000, age: 24 * 3600 }, // Keep 1000 or 24h
    removeOnFail: { count: 5000, age: 7 * 24 * 3600 }, // Keep failures for 7 days
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000 // Start with 5s backoff
    }
  }
});

// Scheduler for delayed/scheduled campaigns
let campaignScheduler;
try {
  campaignScheduler = new QueueScheduler('campaign-engine', { connection });
} catch (err) {
  console.warn('[CampaignQueue] QueueScheduler init warning:', err.message);
}

// Queue events for monitoring
const campaignQueueEvents = new QueueEvents('campaign-engine', { connection });

// ─────────────────────────────────────────────────────────────────────────────
// JOB TYPES
// ─────────────────────────────────────────────────────────────────────────────

const JOB_TYPES = {
  CAMPAIGN_START: 'campaign-start',      // Initialize campaign, create batches
  BATCH_PROCESS: 'batch-process',        // Process a single batch
  CAMPAIGN_CHECK: 'campaign-check',      // Check campaign completion
  CAMPAIGN_CLEANUP: 'campaign-cleanup',  // Cleanup after completion
  SCHEDULED_START: 'scheduled-start'     // Start scheduled campaign
};

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE PRODUCER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enqueue campaign for execution
 * Creates batches and schedules batch jobs
 */
async function enqueueCampaign(campaignId, workspaceId, options = {}) {
  const { priority = 1, delay = 0 } = options;

  const Workspace = require('../models/Workspace');
  const workspace = await Workspace.findById(workspaceId);
  const isBspConnected = workspace && typeof workspace.isBspConnected === 'function'
    ? workspace.isBspConnected()
    : false;
  if (!isBspConnected) {
    throw new Error('Workspace is not BSP-connected');
  }
  
  const jobId = `campaign:${campaignId}:start`;
  
  const job = await campaignQueue.add(
    JOB_TYPES.CAMPAIGN_START,
    {
      campaignId: campaignId.toString(),
      workspaceId: workspaceId.toString(),
      enqueuedAt: new Date().toISOString()
    },
    {
      jobId,
      priority,
      delay,
      removeOnComplete: true
    }
  );
  
  console.log(`[CampaignQueue] Enqueued campaign start: ${campaignId}, jobId: ${job.id}`);
  return job;
}

/**
 * Enqueue a batch for processing
 */
async function enqueueBatch(batchId, campaignId, workspaceId, batchIndex, options = {}) {
  const { priority = 1, delay = 0 } = options;
  
  const jobId = `campaign:${campaignId}:batch:${batchIndex}`;
  
  const job = await campaignQueue.add(
    JOB_TYPES.BATCH_PROCESS,
    {
      batchId: batchId.toString(),
      campaignId: campaignId.toString(),
      workspaceId: workspaceId.toString(),
      batchIndex,
      enqueuedAt: new Date().toISOString()
    },
    {
      jobId,
      priority,
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10000 // 10s initial backoff for batches
      }
    }
  );
  
  console.log(`[CampaignQueue] Enqueued batch: campaign=${campaignId}, batch=${batchIndex}`);
  return job;
}

/**
 * Enqueue multiple batches with staggered delays (rate limiting)
 * @param {Array} batches - Array of batch documents
 * @param {Number} delayBetweenMs - Delay between batch starts
 */
async function enqueueBatches(batches, delayBetweenMs = 1000) {
  const jobs = [];
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const delay = i * delayBetweenMs; // Stagger batch starts
    
    const job = await enqueueBatch(
      batch._id,
      batch.campaign,
      batch.workspace,
      batch.batchIndex,
      { delay }
    );
    
    jobs.push(job);
  }
  
  console.log(`[CampaignQueue] Enqueued ${jobs.length} batches with ${delayBetweenMs}ms stagger`);
  return jobs;
}

/**
 * Schedule campaign for future execution
 */
async function scheduleCampaign(campaignId, workspaceId, scheduledAt) {
  const now = new Date();
  const scheduleTime = new Date(scheduledAt);
  const delay = Math.max(0, scheduleTime.getTime() - now.getTime());
  
  const jobId = `campaign:${campaignId}:scheduled`;
  
  const job = await campaignQueue.add(
    JOB_TYPES.SCHEDULED_START,
    {
      campaignId: campaignId.toString(),
      workspaceId: workspaceId.toString(),
      scheduledAt: scheduledAt
    },
    {
      jobId,
      delay,
      removeOnComplete: true
    }
  );
  
  console.log(`[CampaignQueue] Scheduled campaign: ${campaignId} for ${scheduledAt} (delay: ${delay}ms)`);
  return job;
}

/**
 * Enqueue campaign completion check
 */
async function enqueueCampaignCheck(campaignId, workspaceId, delay = 5000) {
  const job = await campaignQueue.add(
    JOB_TYPES.CAMPAIGN_CHECK,
    {
      campaignId: campaignId.toString(),
      workspaceId: workspaceId.toString()
    },
    {
      jobId: `campaign:${campaignId}:check:${Date.now()}`,
      delay,
      removeOnComplete: true
    }
  );
  
  return job;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE CONTROL FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pause all jobs for a campaign
 * Used when campaign is manually paused
 */
async function pauseCampaignJobs(campaignId) {
  const jobs = await campaignQueue.getJobs(['waiting', 'delayed']);
  let pausedCount = 0;
  
  for (const job of jobs) {
    if (job.data.campaignId === campaignId.toString()) {
      try {
        await job.remove();
        pausedCount++;
      } catch (err) {
        console.error(`[CampaignQueue] Failed to remove job ${job.id}:`, err.message);
      }
    }
  }
  
  console.log(`[CampaignQueue] Paused ${pausedCount} jobs for campaign: ${campaignId}`);
  return pausedCount;
}

/**
 * Get jobs status for a campaign
 */
async function getCampaignJobsStatus(campaignId) {
  const waiting = await campaignQueue.getJobs(['waiting']);
  const active = await campaignQueue.getJobs(['active']);
  const delayed = await campaignQueue.getJobs(['delayed']);
  const failed = await campaignQueue.getJobs(['failed']);
  
  const filterByCampaign = (jobs) => 
    jobs.filter(j => j.data.campaignId === campaignId.toString());
  
  return {
    waiting: filterByCampaign(waiting).length,
    active: filterByCampaign(active).length,
    delayed: filterByCampaign(delayed).length,
    failed: filterByCampaign(failed).length
  };
}

/**
 * Retry failed jobs for a campaign
 */
async function retryFailedJobs(campaignId) {
  const failed = await campaignQueue.getJobs(['failed']);
  let retriedCount = 0;
  
  for (const job of failed) {
    if (job.data.campaignId === campaignId.toString()) {
      try {
        await job.retry();
        retriedCount++;
      } catch (err) {
        console.error(`[CampaignQueue] Failed to retry job ${job.id}:`, err.message);
      }
    }
  }
  
  console.log(`[CampaignQueue] Retried ${retriedCount} failed jobs for campaign: ${campaignId}`);
  return retriedCount;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE MONITORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get queue health metrics
 */
async function getQueueHealth() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    campaignQueue.getWaitingCount(),
    campaignQueue.getActiveCount(),
    campaignQueue.getCompletedCount(),
    campaignQueue.getFailedCount(),
    campaignQueue.getDelayedCount()
  ]);
  
  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + delayed
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────────────────────────────

campaignQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`[CampaignQueue] Job completed: ${jobId}`);
});

campaignQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`[CampaignQueue] Job failed: ${jobId}, reason: ${failedReason}`);
});

campaignQueueEvents.on('stalled', ({ jobId }) => {
  console.warn(`[CampaignQueue] Job stalled: ${jobId}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Queues
  campaignQueue,
  campaignQueueEvents,
  connection,
  
  // Job types
  JOB_TYPES,
  
  // Producer functions
  enqueueCampaign,
  enqueueBatch,
  enqueueBatches,
  scheduleCampaign,
  enqueueCampaignCheck,
  
  // Control functions
  pauseCampaignJobs,
  getCampaignJobsStatus,
  retryFailedJobs,
  
  // Monitoring
  getQueueHealth
};
