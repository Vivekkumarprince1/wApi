import axios from 'axios';
import mongoose from 'mongoose';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { config } from '../config';
import { getSharedRedis } from '../utils/ioredis';

export type ServiceHealth = {
  status: 'ok' | 'degraded' | 'down';
  latency?: number;
  message?: string;
};

export type QueueDepth = {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  oldestWaitingMs?: number;
};

const QUEUES_TO_PROBE = [
  'webhook-queue',
  'bulk-messages',
  'contact-imports',
];

export class HealthService {
  /**
   * Check health of a specific microservice (HTTP /health probe).
   */
  static async checkMicroservice(url: string): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const response = await axios.get(`${url.replace(/\/$/, '')}/health`, { timeout: 2000 });
      return {
        status: response.status === 200 ? 'ok' : 'degraded',
        latency: Date.now() - start,
        message: response.data?.status || 'Active'
      };
    } catch (err: any) {
      return {
        status: 'down',
        message: err.message
      };
    }
  }

  /**
   * Quick Redis liveness probe with a short connect timeout. Uses a
   * short-lived dedicated connection so a hung shared client doesn't make
   * the health endpoint hang too.
   */
  static async checkRedis(): Promise<ServiceHealth> {
    const redis = new IORedis(process.env.REDIS_URL as string, {
      maxRetriesPerRequest: 0,
      connectTimeout: 2000,
      retryStrategy: () => null,
    });

    const start = Date.now();
    try {
      await redis.ping();
      const latency = Date.now() - start;
      redis.disconnect();
      return { status: 'ok', latency };
    } catch (err: any) {
      redis.disconnect();
      return { status: 'down', message: err.message };
    }
  }

  /**
   * Mongo connection state + a cheap ping for read-latency.
   */
  static async checkMongo(): Promise<ServiceHealth> {
    const ready = mongoose.connection.readyState === 1;
    if (!ready) {
      return { status: 'down', message: `readyState=${mongoose.connection.readyState}` };
    }
    const start = Date.now();
    try {
      await mongoose.connection.db?.admin().ping();
      return { status: 'ok', latency: Date.now() - start };
    } catch (err: any) {
      return { status: 'degraded', message: err.message };
    }
  }

  /**
   * BullMQ queue depths + age of oldest waiting job. Useful for
   * autoscaler / on-call dashboards to spot back-pressure.
   */
  static async checkQueues(): Promise<QueueDepth[]> {
    const connection = getSharedRedis();
    const results: QueueDepth[] = [];

    for (const name of QUEUES_TO_PROBE) {
      try {
        const queue = new Queue(name, { connection: connection as any });
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
        const [oldestWaiting] = await queue.getJobs(['waiting'], 0, 0);
        let oldestWaitingMs: number | undefined;
        if (oldestWaiting?.timestamp) {
          oldestWaitingMs = Date.now() - oldestWaiting.timestamp;
        }
        results.push({
          name,
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          delayed: counts.delayed || 0,
          failed: counts.failed || 0,
          oldestWaitingMs,
        });
      } catch (err: any) {
        results.push({ name, waiting: -1, active: -1, delayed: -1, failed: -1, oldestWaitingMs: undefined });
      }
    }

    return results;
  }

  /**
   * Deep system-wide health report. Includes:
   * - Downstream microservices reachability + latency
   * - Mongo readyState + ping latency
   * - Redis ping latency
   * - BullMQ queue depths + oldest-waiting age
   */
  static async getFullReport() {
    const [automation, campaign, billing, redis, mongo, queues] = await Promise.all([
      this.checkMicroservice(config.automationServiceUrl),
      this.checkMicroservice(config.campaignServiceUrl),
      this.checkMicroservice(config.billingServiceUrl),
      this.checkRedis(),
      this.checkMongo(),
      this.checkQueues(),
    ]);

    const overallOk = [automation, campaign, billing, redis, mongo].every(s => s.status === 'ok');

    return {
      status: overallOk ? 'ok' : 'degraded',
      timestamp: new Date(),
      services: { automation, campaign, billing },
      infrastructure: { mongodb: mongo, redis },
      queues,
    };
  }
}
