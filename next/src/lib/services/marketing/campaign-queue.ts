import { Queue, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';

/**
 * CAMPAIGN QUEUE SERVICE
 * 
 * Manages BullMQ infrastructure for marketing campaigns:
 * - Campaign Initialization
 * - Batch Processing
 * - Scheduled Execution
 * - Retries & Error Handling
 */

import { getSharedConnection } from '../../ioredis';

// Shared Redis connection for BullMQ
const connection = getSharedConnection();

// Main Campaign Queue
export const campaignQueue = new Queue('campaign-engine', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000, age: 24 * 3600 },
    removeOnFail: { count: 5000, age: 7 * 24 * 3600 },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const campaignQueueEvents = new QueueEvents('campaign-engine', { connection });

export const JOB_TYPES = {
  CAMPAIGN_START: 'campaign-start',
  BATCH_PROCESS: 'batch-process',
  CAMPAIGN_CHECK: 'campaign-check',
  SCHEDULED_START: 'scheduled-start',
  CLEANUP: 'cleanup'
} as const;

export class CampaignQueueService {
  /**
   * Enqueue a campaign for immediate or delayed start
   */
  static async enqueue(campaignId: string, workspaceId: string, options: { delay?: number; priority?: number } = {}) {
    const { delay = 0, priority = 1 } = options;
    
    // Use timestamp in jobId to prevent deduplication blocks if a previous start job failed
    const jobId = `campaign_${campaignId}_start_${Date.now()}`;

    const job = await campaignQueue.add(
      JOB_TYPES.CAMPAIGN_START,
      {
        campaignId,
        workspaceId,
        enqueuedAt: new Date().toISOString()
      },
      {
        jobId,
        priority,
        delay,
        removeOnComplete: true
      }
    );

    console.log(`[CampaignQueue] 🚀 Enqueued campaign ${campaignId} (Job ID: ${job.id})`);
    return job;
  }

  /**
   * Enqueue a batch for processing
   */
  static async enqueueBatch(batchId: string, campaignId: string, workspaceId: string, batchIndex: number, delay = 0) {
    const jobId = `campaign_${campaignId}_batch_${batchIndex}`;

    return await campaignQueue.add(
      JOB_TYPES.BATCH_PROCESS,
      {
        batchId,
        campaignId,
        workspaceId,
        batchIndex,
        enqueuedAt: new Date().toISOString()
      },
      {
        jobId,
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 }
      }
    );
  }

  /**
   * Pause/Cancel jobs for a campaign
   */
  static async cancelJobs(campaignId: string) {
    const jobs = await campaignQueue.getJobs(['waiting', 'delayed']);
    let count = 0;
    
    for (const job of jobs) {
      if (job.data.campaignId === campaignId) {
        await job.remove();
        count++;
      }
    }

    console.log(`[CampaignQueue] 🛑 Cancelled ${count} jobs for campaign ${campaignId}`);
    return count;
  }

  /**
   * Get Queue Metrics
   */
  static async getMetrics() {
    const [waiting, active, delayed, failed] = await Promise.all([
      campaignQueue.getWaitingCount(),
      campaignQueue.getActiveCount(),
      campaignQueue.getDelayedCount(),
      campaignQueue.getFailedCount()
    ]);

    return { waiting, active, delayed, failed };
  }

  /**
   * Enqueue a repeatable maintenance job
   */
  static async startMaintenance() {
    // Remove legacy repeat schedules to prevent duplicate maintenance execution.
    const repeatables = await campaignQueue.getRepeatableJobs();
    const legacyKeys = repeatables
      .filter((job) => job.name === JOB_TYPES.CAMPAIGN_CHECK && job.key !== 'campaign-maintenance-check')
      .map((job) => job.key);

    for (const key of legacyKeys) {
      try {
        await campaignQueue.removeRepeatableByKey(key);
        console.log(`[CampaignQueue] Removed legacy repeat key: ${key}`);
      } catch (err: any) {
        console.warn(`[CampaignQueue] Failed to remove repeat key ${key}:`, err?.message || err);
      }
    }

    return await campaignQueue.add(
      JOB_TYPES.CAMPAIGN_CHECK,
      {},
      {
        jobId: 'campaign-maintenance-check',
        repeat: { pattern: '*/5 * * * *', key: 'campaign-maintenance-check' }, // Every 5 minutes
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 }
      }
    );
  }

  /**
   * Pause campaign queue
   */
  static async pause(campaignId: string) {
    console.log(`[CampaignQueue] Pausing campaign: ${campaignId}`);
    // Implement pause logic if needed
  }
}

// Export convenience functions
export const enqueueCampaign = CampaignQueueService.enqueue;
export const pauseCampaignQueue = CampaignQueueService.pause;
