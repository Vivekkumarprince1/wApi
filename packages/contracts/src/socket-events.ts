import type { ObjectIdString } from './common';

/**
 * Socket.io event names broadcast to a workspace room
 * (`workspace:${workspaceId}`) or a conversation room
 * (`conversation:${conversationId}`).
 *
 * Frontend listeners live in:
 *   - frontend/src/components/layout/socket-hub.tsx (workspace-scoped)
 *   - frontend/src/app/inbox/page.tsx (conversation + inbox-scoped)
 */
export type WorkspaceSocketEvent =
  | 'workspace:wallet_update'
  | 'workspace:notification'
  | 'campaign:status_update'
  | 'campaign:batch_completed'
  | 'campaign:message_status_batch'
  | 'campaign:message_status_update'
  | 'inbox:message_new'
  | 'inbox:message_sent'
  | 'inbox:message_status'
  | 'inbox:status_batch'
  | 'inbox:conversation_updated'
  | 'inbox:reopened'
  | 'inbox:typing'
  | 'agent:online'
  | 'agent:offline'
  | 'microservice_event';

export type ConversationSocketEvent =
  | 'conversation:typing'
  | 'conversation:user-joined'
  | 'conversation:user-left';

export interface CampaignStatusUpdatePayload {
  campaignId: ObjectIdString;
  status: string;
  reason?: string;
  totals?: Record<string, number>;
  totalBatches?: number;
  updatedAt?: string | Date;
  startedAt?: string | Date;
}

export interface CampaignBatchCompletedPayload {
  campaignId: ObjectIdString;
  batchIndex: number;
  successCount: number;
  failCount: number;
  isLastBatch: boolean;
  totals?: Record<string, number>;
}

export interface InboxMessagePayload {
  conversationId: ObjectIdString;
  message: Record<string, unknown>;
}
