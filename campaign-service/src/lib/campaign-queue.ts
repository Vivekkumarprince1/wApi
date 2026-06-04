import { Queue, QueueEvents } from 'bullmq';
import { getSharedRedis } from './redis';

const connection = getSharedRedis();

// Main Campaign Queue consumed by the campaign-service worker.
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

  static async enqueueBatch(batchId: string | any, campaignId: string, workspaceId: string, batchIndex: number, delayMs: number) {
    return await campaignQueue.add(JOB_TYPES.BATCH_PROCESS, 
      { batchId: batchId.toString(), campaignId, workspaceId, batchIndex },
      { delay: delayMs }
    );
  }
}

export const enqueueCampaign = CampaignQueueService.enqueue;
