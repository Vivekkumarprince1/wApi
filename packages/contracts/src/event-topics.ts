import type { ObjectIdString } from './common';

/** Redis Pub/Sub topics used across the decoupled wApi platform. */
export const EventTopics = {
  RAW_WEBHOOK_EVENTS: 'raw-webhook-events',
  PARSED_MESSAGE_EVENTS: 'parsed-message-events',
  CHAT_REALTIME_SYNC: 'chat-realtime-sync',
  BILLING_EVENTS: 'billing-events',
  CAMPAIGN_EVENTS: 'campaign-events',
  CONTACT_EVENTS: 'contact-events',
  CAMPAIGN_LEDGER_OPS: 'campaign-ledger-ops',
  CAMPAIGN_BUDGET_RESERVED: 'campaign-budget-reserved',
  AUTOMATION_EVENTS: 'automation-events',
  /** FC.1 – Admin/compliance audit trail */
  AUDIT_EVENTS: 'audit-events',
} as const;

export type EventTopic = typeof EventTopics[keyof typeof EventTopics];

/** 1. Raw Webhook Event Contract */
export interface RawWebhookEvent {
  eventId: string;
  eventType: 'message.status' | 'message.inbound' | 'billing.event' | 'template.event' | 'unknown';
  provider: 'gupshup' | 'meta';
  timestamp: string;
  rawPayload: Record<string, unknown>;
}

/** 2. Standardized Parsed Message Event Contract */
export interface ParsedMessageEvent {
  eventId: string;
  provider: 'gupshup' | 'meta';
  workspaceId?: ObjectIdString;
  appId: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'interactive' | 'status_update';
  direction: 'inbound' | 'outbound';
  senderPhone: string;
  recipientPhone: string;
  timestamp: string;
  
  // Message Body Details
  messageId: string;
  text?: string;
  mediaUrl?: string;
  flowResponse?: Record<string, unknown>;
  
  // Status update details (if type === 'status_update')
  statusUpdate?: {
    status: 'sent' | 'delivered' | 'read' | 'failed';
    error?: string;
    timestamp: string;
  };
}

/** 3. Chat Real-time Synchronization Event */
export interface ChatRealtimeSyncEvent {
  workspaceId: ObjectIdString;
  conversationId: ObjectIdString;
  messageId: ObjectIdString;
  type: 'message_created' | 'status_updated' | 'conversation_assigned' | 'conversation_status_changed';
  timestamp: string;
  payload: Record<string, unknown>;
}

/** 4. Automation Event Contract */
export interface AutomationEvent {
  eventId: string;
  workspaceId: ObjectIdString;
  triggerType: 'message_received' | 'status_changed' | 'form_submitted';
  timestamp: string;
  context: {
    messageId?: ObjectIdString;
    contactId?: ObjectIdString;
    phone: string;
    text?: string;
    flowResponse?: Record<string, unknown>;
    variables?: Record<string, unknown>;
  };
}

/** 5. Billing Event Contract */
export interface BillingEventPayload {
  eventId: string;
  event: 'plan_purchased' | 'order_paid' | 'wallet_recharged' | 'funds_deducted' | 'budget_reserved' | 'budget_settled';
  workspaceId: ObjectIdString;
  timestamp: string;
  payload: Record<string, unknown>;
}

/** 6. Contact Event Contract */
export interface ContactEventPayload {
  eventId: string;
  event: 'contact_created' | 'contact_updated' | 'contact_deleted' | 'contact_imported' | 'tag_created' | 'tag_deleted' | 'quick_reply_saved' | 'quick_reply_deleted';
  workspaceId: ObjectIdString;
  timestamp: string;
  payload: Record<string, unknown>;
}

/** 7. Audit Event Contract (audit-events topic) — produced by auth-service */
export type AuditEventAction =
  | 'USER_ROLE_UPDATE'
  | 'USER_STATUS_UPDATE'
  | 'USER_DELETE'
  | 'USER_IMPERSONATION'
  | 'PLAN_CREATE'
  | 'PLAN_UPDATE'
  | 'PLAN_DELETE'
  | 'WORKSPACE_DELETE'
  | 'SETTINGS_UPDATE'
  | 'BROADCAST_NOTICE'
  | 'SECURITY_EMERGENCY_FREEZE'
  | 'DATA_EXPLORER_UPDATE'
  | 'WEBHOOK_POLICY_CREATE'
  | 'WEBHOOK_POLICY_UPDATE';

export interface AuditEventPayload {
  /** Unique event ID (UUID) */
  eventId: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** The admin/system user who triggered the action */
  actorId: ObjectIdString;
  /** Human-readable action label */
  action: AuditEventAction;
  /** Affected resource information */
  resource?: {
    type: string;
    id: string;
    name?: string;
  };
  /** Arbitrary structured context for the action */
  details?: Record<string, unknown>;
  /** Source IP address (best-effort, taken from X-Forwarded-For / req.ip) */
  ip?: string;
  /** User-Agent of the originating request */
  userAgent?: string;
}
