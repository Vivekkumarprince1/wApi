import { Queue, QueueEvents } from 'bullmq';
import { getSharedConnection } from '../../ioredis';

const connection = getSharedConnection();

export const billingQueue = new Queue('billing-engine', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 100, age: 24 * 3600 },
    removeOnFail: { count: 1000, age: 7 * 24 * 3600 },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const billingQueueEvents = new QueueEvents('billing-engine', { connection });

export const BILLING_JOBS = {
  RENEWAL_CHECK: 'renewal-check',
  INVOICE_GENERATION: 'invoice-generation',
} as const;

export class BillingQueueService {
  /**
   * Start the daily billing renewal cycle
   */
  static async startRenewalCycle() {
    console.log('[BillingQueue] 📅 Starting daily renewal cycle...');
    return await billingQueue.add(
      BILLING_JOBS.RENEWAL_CHECK,
      {},
      {
        repeat: { pattern: '0 0 * * *' }, // Daily at midnight
        jobId: 'daily_renewal_check',
        removeOnComplete: true
      }
    );
  }

  /**
   * Manually trigger a renewal check (for testing or recovery)
   */
  static async triggerImmediateRenewalCheck() {
    return await billingQueue.add(BILLING_JOBS.RENEWAL_CHECK, { manual: true });
  }
}
