import axios from 'axios';
import mongoose from 'mongoose';
import IORedis from 'ioredis';
import { config } from '../config';

export type ServiceHealth = {
  status: 'ok' | 'degraded' | 'down';
  latency?: number;
  message?: string;
};

export class HealthService {
  /**
   * Check health of a specific microservice
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
   * Check Redis connectivity
   */
  static async checkRedis(): Promise<ServiceHealth> {
    const redis = new IORedis(process.env.REDIS_URL as string, { 
      maxRetriesPerRequest: 0,
      connectTimeout: 2000,
      retryStrategy: () => null 
    });
    
    try {
      await redis.ping();
      redis.disconnect();
      return { status: 'ok' };
    } catch (err: any) {
      redis.disconnect();
      return { status: 'down', message: err.message };
    }
  }

  /**
   * Get system-wide health report
   */
  static async getFullReport() {
    const [automation, campaign, billing, redis] = await Promise.all([
      this.checkMicroservice(config.automationServiceUrl),
      this.checkMicroservice(config.campaignServiceUrl),
      this.checkMicroservice(config.billingServiceUrl),
      this.checkRedis()
    ]);

    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'ok' : 'down';

    return {
      status: [automation, campaign, billing, redis].every(s => s.status === 'ok') && dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date(),
      services: {
        automation,
        campaign,
        billing
      },
      infrastructure: {
        mongodb: { status: dbStatus },
        redis
      }
    };
  }
}
