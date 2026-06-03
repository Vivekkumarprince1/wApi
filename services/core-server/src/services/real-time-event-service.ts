/**
 * Real-time Event Emitter Service
 * Handles emitting Socket.io events across services using Redis Emitter
 * This allows events from microservices to be delivered to all connected clients
 */

import { Emitter } from '@socket.io/redis-emitter';
import redis from '../redis';

type WorkflowStatus = 'running' | 'completed' | 'failed' | 'paused' | 'resumed';
type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
type BillingStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface WorkflowEvent {
  workflowId: string;
  workflowName: string;
  status: WorkflowStatus;
  executionId?: string;
  triggerData?: Record<string, any>;
  error?: string;
  timestamp: Date;
}

export interface CampaignEvent {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  totalContacts?: number;
  sentCount?: number;
  failedCount?: number;
  progress?: number;
  error?: string;
  timestamp: Date;
}

export interface BillingEvent {
  orderId: string;
  status: BillingStatus;
  amount: number;
  currency: string;
  paymentMethod?: string;
  error?: string;
  timestamp: Date;
}

export class RealTimeEventService {
  private emitter: Emitter;

  constructor() {
    // Initialize Redis Emitter for Socket.io
    this.emitter = new Emitter(redis);
  }

  /**
   * Emit workflow status change to workspace
   */
  async emitWorkflowUpdate(workspaceId: string, event: WorkflowEvent): Promise<void> {
    try {
      this.emitter
        .to(`workspace:${workspaceId}`)
        .emit('workflow:update', {
          ...event,
          timestamp: new Date().toISOString(),
        });

      console.log(`[RealTimeEvent] Workflow update: ${event.workflowName} - ${event.status}`);
    } catch (error) {
      console.error('[RealTimeEvent] Failed to emit workflow update:', error);
    }
  }

  /**
   * Emit campaign status change to workspace
   */
  async emitCampaignUpdate(workspaceId: string, event: CampaignEvent): Promise<void> {
    try {
      this.emitter
        .to(`workspace:${workspaceId}`)
        .emit('campaign:update', {
          ...event,
          timestamp: new Date().toISOString(),
        });

      console.log(`[RealTimeEvent] Campaign update: ${event.campaignName} - ${event.status}`);
    } catch (error) {
      console.error('[RealTimeEvent] Failed to emit campaign update:', error);
    }
  }

  /**
   * Emit billing/payment event to workspace
   */
  async emitBillingUpdate(workspaceId: string, event: BillingEvent): Promise<void> {
    try {
      this.emitter
        .to(`workspace:${workspaceId}`)
        .emit('billing:update', {
          ...event,
          timestamp: new Date().toISOString(),
        });

      console.log(`[RealTimeEvent] Billing update: Order ${event.orderId} - ${event.status}`);
    } catch (error) {
      console.error('[RealTimeEvent] Failed to emit billing update:', error);
    }
  }

  /**
   * Emit contact update
   */
  async emitContactUpdate(
    workspaceId: string,
    contactId: string,
    action: 'created' | 'updated' | 'deleted',
    contactData: Record<string, any>
  ): Promise<void> {
    try {
      this.emitter
        .to(`workspace:${workspaceId}`)
        .emit('contact:update', {
          contactId,
          action,
          data: contactData,
          timestamp: new Date().toISOString(),
        });

      console.log(`[RealTimeEvent] Contact ${action}: ${contactId}`);
    } catch (error) {
      console.error('[RealTimeEvent] Failed to emit contact update:', error);
    }
  }

  /**
   * Emit conversation message
   */
  async emitNewMessage(
    workspaceId: string,
    conversationId: string,
    messageData: Record<string, any>
  ): Promise<void> {
    try {
      this.emitter
        .to(`workspace:${workspaceId}`)
        .to(`conversation:${conversationId}`)
        .emit('message:new', {
          conversationId,
          ...messageData,
          timestamp: new Date().toISOString(),
        });

      console.log(`[RealTimeEvent] New message in conversation: ${conversationId}`);
    } catch (error) {
      console.error('[RealTimeEvent] Failed to emit new message:', error);
    }
  }

  /**
   * Emit conversation status change
   */
  async emitConversationStatusChange(
    workspaceId: string,
    conversationId: string,
    status: 'open' | 'closed' | 'assigned' | 'resolved',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      this.emitter
        .to(`workspace:${workspaceId}`)
        .to(`conversation:${conversationId}`)
        .emit('conversation:status-change', {
          conversationId,
          status,
          metadata,
          timestamp: new Date().toISOString(),
        });

      console.log(`[RealTimeEvent] Conversation status changed: ${conversationId} -> ${status}`);
    } catch (error) {
      console.error('[RealTimeEvent] Failed to emit conversation status change:', error);
    }
  }

  /**
   * Emit bulk operation progress
   */
  async emitBulkOperationProgress(
    workspaceId: string,
    operationId: string,
    progress: number,
    totalItems: number,
    processedItems: number,
    status: 'started' | 'in-progress' | 'completed' | 'failed'
  ): Promise<void> {
    try {
      this.emitter
        .to(`workspace:${workspaceId}`)
        .emit('bulk-operation:progress', {
          operationId,
          progress,
          totalItems,
          processedItems,
          status,
          timestamp: new Date().toISOString(),
        });

      console.log(
        `[RealTimeEvent] Bulk operation progress: ${operationId} - ${progress}%`
      );
    } catch (error) {
      console.error('[RealTimeEvent] Failed to emit bulk operation progress:', error);
    }
  }

  /**
   * Emit generic workspace event
   */
  async emitWorkspaceEvent(
    workspaceId: string,
    eventType: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      this.emitter
        .to(`workspace:${workspaceId}`)
        .emit(`workspace:${eventType}`, {
          ...data,
          timestamp: new Date().toISOString(),
        });

      console.log(`[RealTimeEvent] Workspace event: ${eventType}`);
    } catch (error) {
      console.error(`[RealTimeEvent] Failed to emit workspace event (${eventType}):`, error);
    }
  }

  /**
   * Emit notification to workspace
   */
  async emitNotification(
    workspaceId: string,
    userId: string,
    notification: {
      type: 'success' | 'error' | 'warning' | 'info';
      title: string;
      message: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      this.emitter
        .to(`workspace:${workspaceId}`)
        .to(`user:${userId}`)
        .emit('notification:received', {
          ...notification,
          timestamp: new Date().toISOString(),
        });

      console.log(`[RealTimeEvent] Notification sent to user: ${userId}`);
    } catch (error) {
      console.error('[RealTimeEvent] Failed to emit notification:', error);
    }
  }

  /**
   * Emit typing indicator
   */
  async emitUserTyping(
    conversationId: string,
    userId: string,
    userName: string,
    isTyping: boolean
  ): Promise<void> {
    try {
      this.emitter
        .to(`conversation:${conversationId}`)
        .emit('user:typing', {
          userId,
          userName,
          isTyping,
          timestamp: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[RealTimeEvent] Failed to emit typing indicator:', error);
    }
  }

  /**
   * Broadcast to all connected clients
   */
  async broadcastToAll(eventType: string, data: Record<string, any>): Promise<void> {
    try {
      this.emitter.emit(eventType, {
        ...data,
        timestamp: new Date().toISOString(),
      });

      console.log(`[RealTimeEvent] Broadcast event: ${eventType}`);
    } catch (error) {
      console.error('[RealTimeEvent] Failed to broadcast event:', error);
    }
  }
}

// Export singleton instance
export const realTimeEventService = new RealTimeEventService();
