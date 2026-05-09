import type { ObjectIdString } from './common';

/**
 * Worker-bridge actions exposed by the monolith at
 * `POST /api/internal/worker-bridge`. Every action MUST include
 * `data.workspaceId` (server enforces this).
 */
export type WorkerBridgeAction =
  | 'send-template'
  | 'preflight-validate'
  | 'socket-broadcast'
  | 'get-pricing'
  | 'get-template'
  | 'get-contact'
  | 'query-contacts'
  | 'count-contacts'
  | 'billing-park'
  | 'billing-settle';

export interface WorkerBridgeBaseData {
  workspaceId: ObjectIdString;
}

export interface SendTemplateData extends WorkerBridgeBaseData {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: unknown[];
  options?: Record<string, unknown>;
}

export interface PreflightValidateData extends WorkerBridgeBaseData {
  templateId: ObjectIdString;
  contactsCount: number;
}

export interface SocketBroadcastData extends WorkerBridgeBaseData {
  event: string;
  payload?: unknown;
}

export interface GetPricingData extends WorkerBridgeBaseData {
  category: string;
}

export interface GetPricingResponse {
  success: boolean;
  cost: number;
  category?: string;
}

export interface GetTemplateData extends WorkerBridgeBaseData {
  templateId: ObjectIdString;
}

export interface GetContactData extends WorkerBridgeBaseData {
  contactId: ObjectIdString;
}

export interface QueryContactsData extends WorkerBridgeBaseData {
  query: Record<string, unknown>;
}

export interface BillingParkData extends WorkerBridgeBaseData {
  amount: number;
  campaignId: ObjectIdString;
}

export interface BillingSettleData extends WorkerBridgeBaseData {
  campaignId: ObjectIdString;
  reservedAmount: number;
  actualSpend: number;
}

export type WorkerBridgeRequest =
  | { action: 'send-template'; data: SendTemplateData }
  | { action: 'preflight-validate'; data: PreflightValidateData }
  | { action: 'socket-broadcast'; data: SocketBroadcastData }
  | { action: 'get-pricing'; data: GetPricingData }
  | { action: 'get-template'; data: GetTemplateData }
  | { action: 'get-contact'; data: GetContactData }
  | { action: 'query-contacts'; data: QueryContactsData }
  | { action: 'count-contacts'; data: QueryContactsData }
  | { action: 'billing-park'; data: BillingParkData }
  | { action: 'billing-settle'; data: BillingSettleData };
