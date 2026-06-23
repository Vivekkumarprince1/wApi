import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { proxyController } from '../../controllers/proxyController';

/**
 * AUTOMATION MICROSERVICE CLIENT
 * This is the official bridge from the Monolith to the Automation Microservice.
 * Now hardened with circuit breakers and retries via proxyController.
 */
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize the queue
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
connection.on('error', (err) => {
  console.error('[AutomationClient] Redis Error:', err.message || err);
});
const automationQueue = new Queue('automation-triggers', { connection: connection as any });

export class AutomationClient {
  /**
   * Process an inbound message via the microservice
   */
  static async handleInbound(data: {
    workspaceId: string;
    contact: any;
    conversationId: string;
    messageId: string;
    body: string;
    metadata?: any;
    isOutsideBusinessHours?: boolean;
  }) {
    try {
      // 1. Trigger microservice via resilient proxy (Fire and forget HTTP)
      proxyController.forwardToService('automation', {
        method: 'POST',
        path: '/api/automation/engine/trigger-inbound',
        data: {
          ...data,
          contactId: data.contact?._id || data.contact?.id,
          phone: data.contact?.phone
        },
        workspaceId: data.workspaceId,
        correlationId: data.messageId
      }).catch(err => {
        console.warn('[AutomationClient] Resilient HTTP trigger failed, relying on queue:', err.message);
      });

      // 2. Enqueue for background processing (the BullMQ worker in main-server)
      await automationQueue.add('inbound_message', {
        type: 'message_received',
        workspaceId: data.workspaceId,
        payload: {
          contactId: data.contact._id || data.contact.id,
          messageId: data.messageId,
          body: data.body,
          ...data.metadata
        }
      });

      return true;
    } catch (error: any) {
      console.error('[AutomationClient] Failed to trigger (handleInbound):', error.message);
      return false;
    }
  }

  /**
   * Trigger an external event (e.g., Shopify Order, New Lead)
   */
  static async triggerEvent(workspaceId: string, event: string, data: any) {
    try {
      // 1. Enqueue for background processing
      await automationQueue.add('event_trigger', {
        type: event,
        workspaceId,
        payload: data
      });

      // 2. Also notify microservice via resilient proxy
      proxyController.forwardToService('automation', {
        method: 'POST',
        path: '/api/automation/engine/trigger-event',
        data: {
          workspaceId,
          event,
          data
        },
        workspaceId
      }).catch(() => {});

      return true;
    } catch (error: any) {
      console.error('[AutomationClient] Event trigger failed:', error.message);
      return false;
    }
  }

  /**
   * Alias for triggerEvent to maintain legacy compatibility
   */
  static async handleEvent(options: {
    workspaceId: string;
    type: string;
    contactId: string;
    metadata?: any;
  }) {
    return this.triggerEvent(options.workspaceId, options.type, {
        contactId: options.contactId,
        ...options.metadata
    });
  }
}
