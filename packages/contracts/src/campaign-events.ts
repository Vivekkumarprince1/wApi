import type { ObjectIdString } from './common';

export type CampaignExecutionStatus =
  | 'queued'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface CampaignBatchReadyEvent {
  eventType: 'campaign.batch.ready';
  correlationId: string;
  workspaceId: ObjectIdString;
  campaignId: ObjectIdString;
  batchId: ObjectIdString;
  scheduledFor?: string;
}

export interface CampaignMessageDispatchedEvent {
  eventType: 'campaign.message.dispatched';
  correlationId: string;
  workspaceId: ObjectIdString;
  campaignId: ObjectIdString;
  campaignMessageId: ObjectIdString;
  contactId: ObjectIdString;
  providerMessageId?: string;
  status: 'accepted' | 'sent' | 'failed';
  errorCode?: string;
  errorMessage?: string;
}

export interface CampaignStatusChangedEvent {
  eventType: 'campaign.status.changed';
  correlationId: string;
  workspaceId: ObjectIdString;
  campaignId: ObjectIdString;
  status: CampaignExecutionStatus;
  totals?: {
    queued?: number;
    sent?: number;
    delivered?: number;
    read?: number;
    failed?: number;
  };
}

export type CampaignEvent =
  | CampaignBatchReadyEvent
  | CampaignMessageDispatchedEvent
  | CampaignStatusChangedEvent;
