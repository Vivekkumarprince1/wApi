import type { ApiResponse, ObjectIdString } from './common';

export type BspProviderCode = 'gupshup';

export type BspConnectionStatus =
  | 'not_started'
  | 'onboarding'
  | 'connected'
  | 'disconnected'
  | 'suspended'
  | 'failed';

export type BspMessageType =
  | 'text'
  | 'template'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'interactive'
  | 'flow'
  | 'location'
  | 'contacts';

export interface InternalServiceHeaders {
  'x-internal-service': string;
  'x-internal-secret': string;
  'x-correlation-id': string;
  'x-workspace-id'?: ObjectIdString;
  'x-user-id'?: ObjectIdString;
}

export interface BspAppRef {
  provider: BspProviderCode;
  appId: string;
  workspaceId: ObjectIdString;
  businessId?: ObjectIdString;
  status: BspConnectionStatus;
  displayPhoneNumber?: string;
  phoneNumberId?: string;
}

export interface StartBspOnboardingRequest {
  workspaceId: ObjectIdString;
  businessId: ObjectIdString;
  userId: ObjectIdString;
  provider: BspProviderCode;
  callbackUrl: string;
  connectionType?: 'new_number' | 'existing_number' | 'migration';
  region?: string;
  phoneNumber?: string;
  metadata?: Record<string, unknown>;
}

export interface StartBspOnboardingResult {
  onboardingSessionId: string;
  provider: BspProviderCode;
  appId?: string;
  url: string;
  state: string;
  expiresAt: string;
}

export type StartBspOnboardingResponse = ApiResponse<StartBspOnboardingResult>;

export interface CompleteBspOnboardingRequest {
  workspaceId: ObjectIdString;
  userId: ObjectIdString;
  provider: BspProviderCode;
  onboardingSessionId?: string;
  state?: string;
  code?: string;
  appId?: string;
}

export interface CompleteBspOnboardingResult {
  app: BspAppRef;
  connectedAt?: string;
  providerResponse?: unknown;
}

export type CompleteBspOnboardingResponse = ApiResponse<CompleteBspOnboardingResult>;

export interface BspSendMessageRequest {
  workspaceId: ObjectIdString;
  provider: BspProviderCode;
  appId: string;
  to: string;
  type: BspMessageType;
  sourcePhone?: string;
  conversationId?: ObjectIdString;
  contactId?: ObjectIdString;
  campaignId?: ObjectIdString;
  idempotencyKey?: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface BspSendMessageResult {
  dispatchId: ObjectIdString;
  success: boolean;
  providerMessageId?: string;
  providerEnvelopeId?: string;
  status: 'accepted' | 'sent' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  providerResponse?: unknown;
}

export type BspSendMessageResponse = ApiResponse<BspSendMessageResult>;

export interface BspTemplateSyncRequest {
  workspaceId: ObjectIdString;
  provider: BspProviderCode;
  appId: string;
  force?: boolean;
}

export interface BspTemplateSyncResult {
  synced: number;
  created: number;
  updated: number;
  failed: number;
}

export type BspTemplateSyncResponse = ApiResponse<BspTemplateSyncResult>;

export type BspWebhookEventType =
  | 'message.inbound'
  | 'message.status'
  | 'billing.event'
  | 'app.event'
  | 'template.event'
  | 'system.event'
  | 'unknown';

export interface NormalizedBspWebhookEvent {
  eventId: string;
  provider: BspProviderCode;
  type: BspWebhookEventType;
  workspaceId?: ObjectIdString;
  appId?: string;
  providerMessageId?: string;
  conversationId?: ObjectIdString;
  contactId?: ObjectIdString;
  campaignId?: ObjectIdString;
  status?: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  rawEventId?: ObjectIdString;
}
