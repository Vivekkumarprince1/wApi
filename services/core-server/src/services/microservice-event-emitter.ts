/**
 * Microservice Event Emitter Bridge
 * Allows microservices to emit Socket.io events to the main server via Redis
 * 
 * Usage in microservices:
 * import { MicroserviceEventBridge } from 'shared/microservice-event-bridge'
 * const bridge = new MicroserviceEventBridge()
 * await bridge.emitWorkflowEvent(workspaceId, event)
 */

import { Emitter } from '@socket.io/redis-emitter';
import redis from 'ioredis';

const redisClient = new redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

export class MicroserviceEventBridge {
  private emitter: Emitter;
  private service: string;

  constructor(serviceName: string = 'microservice') {
    this.emitter = new Emitter(redisClient);
    this.service = serviceName;
  }

  /**
   * Emit workflow status update
   */
  async emitWorkflowStatus(
    workspaceId: string,
    workflowId: string,
    status: 'running' | 'completed' | 'failed',
    data?: Record<string, any>
  ): Promise<void> {
    try {
      this.emitter.to(`workspace:${workspaceId}`).emit('workflow:status', {
        workflowId,
        status,
        service: this.service,
        ...data,
        timestamp: new Date().toISOString(),
      });

      console.log(
        `[${this.service}] Emitted workflow ${status} event for workflow ${workflowId}`
      );
    } catch (error) {
      console.error(
        `[${this.service}] Failed to emit workflow event:`,
        error
      );
    }
  }

  /**
   * Emit campaign execution update
   */
  async emitCampaignUpdate(
    workspaceId: string,
    campaignId: string,
    status: string,
    metrics?: {
      totalContacts?: number;
      sentCount?: number;
      failedCount?: number;
      progress?: number;
    }
  ): Promise<void> {
    try {
      this.emitter.to(`workspace:${workspaceId}`).emit('campaign:status', {
        campaignId,
        status,
        ...metrics,
        service: this.service,
        timestamp: new Date().toISOString(),
      });

      console.log(
        `[${this.service}] Emitted campaign ${status} event for campaign ${campaignId}`
      );
    } catch (error) {
      console.error(
        `[${this.service}] Failed to emit campaign event:`,
        error
      );
    }
  }

  /**
   * Emit payment webhook processed event
   */
  async emitPaymentProcessed(
    workspaceId: string,
    orderId: string,
    status: 'completed' | 'failed' | 'refunded',
    amount: number,
    error?: string
  ): Promise<void> {
    try {
      this.emitter.to(`workspace:${workspaceId}`).emit('payment:processed', {
        orderId,
        status,
        amount,
        error,
        service: this.service,
        timestamp: new Date().toISOString(),
      });

      console.log(
        `[${this.service}] Emitted payment ${status} event for order ${orderId}`
      );
    } catch (error) {
      console.error(
        `[${this.service}] Failed to emit payment event:`,
        error
      );
    }
  }

  /**
   * Emit generic event
   */
  async emitEvent(
    workspaceId: string,
    eventName: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      this.emitter.to(`workspace:${workspaceId}`).emit(eventName, {
        ...data,
        service: this.service,
        timestamp: new Date().toISOString(),
      });

      console.log(`[${this.service}] Emitted event: ${eventName}`);
    } catch (error) {
      console.error(
        `[${this.service}] Failed to emit event (${eventName}):`,
        error
      );
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await redisClient.quit();
      console.log(`[${this.service}] Event bridge disconnected`);
    } catch (error) {
      console.error(`[${this.service}] Error disconnecting event bridge:`, error);
    }
  }
}

// Export convenience function for common use case
export async function emitWorkspaceEvent(
  workspaceId: string,
  eventName: string,
  data: Record<string, any>,
  serviceName: string = 'microservice'
): Promise<void> {
  const bridge = new MicroserviceEventBridge(serviceName);
  await bridge.emitEvent(workspaceId, eventName, data);
}
