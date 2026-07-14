import { Queue } from 'bullmq';
import { getSharedRedis } from './redis';

const connection = getSharedRedis();

// Main Campaign Queue consumed by the campaign-service worker.
export const campaignQueue = new Queue('campaign-engine', {
  connection: connection as any,
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

export const campaignDeadLetterQueue = new Queue('campaign-engine-dlq', {
  connection: connection as any,
  defaultJobOptions: { removeOnComplete: { age: 30 * 24 * 3600, count: 10000 } },
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

    const jobId = `campaign:${campaignId}:start`;

    const job = await campaignQueue.add(
      JOB_TYPES.CAMPAIGN_START,
      {
        campaignId,
        workspaceId,
        operationId: campaignId,
        correlationId: `campaign:${campaignId}`,
        enqueuedAt: new Date().toISOString()
      },
      {
        jobId,
        priority,
        delay,
        removeOnComplete: { age: 24 * 3600, count: 1000 }
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
      { batchId: batchId.toString(), campaignId, workspaceId, operationId: campaignId, batchIndex, correlationId: `campaign:${campaignId}:batch:${batchIndex}` },
      { delay: delayMs, jobId: `campaign:${campaignId}:batch:${batchIndex}` }
    );
  }

  static async deadLetter(job: any, error: Error) {
    await campaignDeadLetterQueue.add('campaign-dead-letter', {
      originalJobId: job?.id,
      jobName: job?.name,
      workspaceId: job?.data?.workspaceId,
      operationId: job?.data?.operationId || job?.data?.campaignId,
      correlationId: job?.data?.correlationId,
      payload: job?.data,
      failureReason: error.message,
      attemptsMade: job?.attemptsMade,
      failedAt: new Date().toISOString(),
    }, { jobId: `dlq:${job?.id}` });
  }

  static async getOperationalCounts() {
    const [main, deadLettered] = await Promise.all([
      campaignQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed'),
      campaignDeadLetterQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
    ]);
    return { ...main, deadLettered: deadLettered.waiting + deadLettered.active + deadLettered.completed };
  }
}

export const enqueueCampaign = CampaignQueueService.enqueue;
