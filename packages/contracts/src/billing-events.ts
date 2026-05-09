import type { ObjectIdString } from './common';

/** BullMQ saga between billing-service and campaign-service. */
export type BillingEventName =
  | 'CampaignCreatedEvent'
  | 'BudgetReservedEvent'
  | 'BudgetReservationFailedEvent'
  | 'CampaignCompletedEvent'
  | 'MessageStatusUpdateEvent';

export interface CampaignCreatedEvent {
  campaignId: ObjectIdString;
  workspaceId: ObjectIdString;
  estimatedCost: number;
  contacts: ObjectIdString[];
  templateId: ObjectIdString;
  templateSnapshot?: Record<string, unknown>;
  variableMapping?: Record<string, unknown>;
}

export interface BudgetReservedEvent {
  campaignId: ObjectIdString;
  workspaceId: ObjectIdString;
  reservedAmount: number;
  contacts?: ObjectIdString[];
  templateId?: ObjectIdString;
  templateSnapshot?: Record<string, unknown>;
  variableMapping?: Record<string, unknown>;
}

export interface BudgetReservationFailedEvent {
  campaignId: ObjectIdString;
  workspaceId: ObjectIdString;
  reason: string;
}

export interface CampaignCompletedEvent {
  campaignId: ObjectIdString;
  workspaceId: ObjectIdString;
  reservedAmount: number;
  actualSpend: number;
}

export interface MessageStatusUpdateEvent {
  campaignId: ObjectIdString;
  messageId: ObjectIdString;
  contactId?: ObjectIdString;
  whatsappMessageId?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  prevStatus?: string;
  timestamp: string | Date;
}

/** Pub/Sub channel published from billing-service. */
export type BillingPubSubEventName =
  | 'wallet_recharged'
  | 'plan_purchased'
  | 'order_paid';

export interface BillingPubSubEnvelope<T = unknown> {
  event: BillingPubSubEventName;
  workspaceId: ObjectIdString;
  payload: T;
}
