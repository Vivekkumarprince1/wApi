import { Queue, Worker, Job } from 'bullmq';
import { config } from '../../config';
import { getSharedConnection } from '../../utils/ioredis';
import { connectRedis } from '@/redis';
import { QUEUE_NAMES } from '@wapi/contracts';

/**
 * Webhook Queue
 * 
 * Reliability layer for handling high-volume provider webhooks.
 * Enqueues payloads for async processing to ensure fast HTTP response times.
 */

const connection = getSharedConnection();
const DELIVERY_DEDUPE_TTL_SECONDS = 6 * 60 * 60;

async function reserveDeliveryId(deliveryId: string): Promise<boolean> {
  try {
    const redis = await connectRedis();
    if (!redis) return true;

    const key = `webhook:dedupe:${deliveryId}`;
    const acquired = await (redis as any).set(key, '1', 'NX', 'EX', DELIVERY_DEDUPE_TTL_SECONDS);

    return acquired === 'OK';
  } catch (error: any) {
    console.warn('[WebhookQueue] Redis dedupe unavailable, falling back to queue-level dedupe:', error.message);
    return true;
  }
}

export const webhookQueue = new Queue(QUEUE_NAMES.WEBHOOKS, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export async function enqueueWebhook(payload: any, deliveryId?: string) {
  const normalizedDeliveryId = String(deliveryId || '').trim();
  const jobId = normalizedDeliveryId
    ? `delivery-${normalizedDeliveryId}`.replace(/[:\s]+/g, '-').slice(0, 200)
    : undefined;

  if (normalizedDeliveryId) {
    const reserved = await reserveDeliveryId(normalizedDeliveryId);
    if (!reserved) {
      console.log(`[WebhookQueue] Duplicate delivery ignored via Redis TTL lock: ${normalizedDeliveryId}`);
      return null;
    }
  }

  if (jobId) {
    const existingJob = await webhookQueue.getJob(jobId);
    if (existingJob) {
      console.log(`[WebhookQueue] Duplicate delivery ignored: ${normalizedDeliveryId}`);
      return existingJob;
    }
  }

  return webhookQueue.add('process-payload', {
    payload,
    deliveryId,
    timestamp: new Date().toISOString()
  }, {
    jobId
  });
}

/**
 * Returns a snapshot of any failed jobs older than `staleAfterMs` (default
 * 5 minutes). Used by the periodic alert job (started in
 * `worker-registry.ts`) to surface back-pressure to operators.
 */
export async function getStaleFailedJobs(staleAfterMs = 5 * 60 * 1000) {
  const failed = await webhookQueue.getFailed(0, 50);
  const cutoff = Date.now() - staleAfterMs;
  return failed
    .filter((job) => (job.finishedOn || job.timestamp || 0) < cutoff)
    .map((job) => ({
      id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      ageMs: Date.now() - (job.finishedOn || job.timestamp || 0),
    }));
}
