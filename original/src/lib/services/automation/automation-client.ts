import axios from 'axios';
import { config } from '../../config';

/**
 * AUTOMATION MICROSERVICE CLIENT
 * This is the official bridge from the Monolith to the Automation Microservice.
 */
const AUTOMATION_SERVICE_URL = process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3001';
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || config.jwtSecret;

export class AutomationClient {
  private static client = axios.create({
    baseURL: AUTOMATION_SERVICE_URL,
    timeout: 5000,
    headers: {
        'x-internal-service-secret': INTERNAL_SERVICE_SECRET
    }
  });

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
      const response = await this.client.post('/api/automation/engine/trigger-inbound', data);
      return response.data?.handled || false;
    } catch (error: any) {
      console.error('[AutomationClient] Failed to trigger microservice (handleInbound):', error.message);
      return false; // Fallback: don't crash the monolith
    }
  }

  /**
   * Trigger an external event (e.g., Shopify Order, New Lead)
   */
  static async triggerEvent(workspaceId: string, event: string, data: any) {
    try {
      await this.client.post('/api/automation/engine/trigger-event', {
        workspaceId,
        event,
        data
      });
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
