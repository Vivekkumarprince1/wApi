/**
 * MODELS INDEX
 * Centralized exports for all Mongoose models
 */

// Auth domain
export * from './auth/User';
export * from './auth/Permission';
export * from './auth/Plan';
export * from './auth/OtpChallenge';
export { Role } from './auth/Role';
export type { IRole, IRoleDocument } from './auth/Role';

// Workspace domain
export * from './workspace/Workspace';
export type { IWorkspace, IWorkspaceDocument } from './workspace/Workspace';
export * from './workspace/InternalNote';

export * from './workspace/Team';
export * from './workspace/WorkspaceInvitation';

// Messaging domain (Forms moved to migrated-models)
export * from './messaging/Contact';
export type { IContact, IContactDocument } from './messaging/Contact';
export * from './messaging/Conversation';
export * from './messaging/ConversationLedger';
export * from './messaging/Message';
export * from './messaging/Tag';
export * from './messaging/QuickReply';
export * from './messaging/ContactEvent';
export * from './messaging/WhatsAppFlow';

// Commerce domain (Order/Invoice moved to migrated-models)
export * from './commerce/Pipeline';
export * from './commerce/Deal';
export * from './commerce/Task';
export * from './commerce/Product';
export * from './commerce/CheckoutCart';
// Commerce settings are re-exported from migrated-models to avoid duplicate exports
// export * from './commerce/CommerceSettings';

// Billing domain

// Audit & Logging domain
export * from './system/Notification';
export * from './ActivityLog';
export type { IActivityLog } from './ActivityLog';


// Onboarding domain
export * from './onboarding/Business';
export * from './onboarding/GupshupApp';
export * from './onboarding/BusinessAppMap';
export * from './onboarding/OnboardingState';

// Campaign domain — FULLY MIGRATED TO campaign-service

// Template domain
export * from './template/Template';
export type { ITemplate, ITemplateDocument } from './template/Template';
export * from './template/TemplateMetric';

// Analytics domain
export * from './analytics/DailyAnalytics';
export * from './analytics/AgentDailyAnalytics';
export * from './analytics/UsageLedger';
export * from './analytics/WhatsAppAd';

// Integration domain
export * from './integration/Integration';
export * from './integration/IntegrationApp';
export * from './integration/WorkspaceIntegration';
export * from './integration/WidgetConfig';

// Migrated Domain (Automation Microservice) - DEPRECATED
// export * from './migrated-models';

// BSP domain
export * from './bsp/BspHealth';
export * from './bsp/WebhookLog';

// Admin domain
export * from './super-admin/AuditLog';
export * from './super-admin/BusinessVerificationPolicy';
export * from './super-admin/WebhookPolicy';
export * from './super-admin/WebhookConfigAuditLog';

// System domain
export * from './system/Notification';

// Support domain
export * from './support/SupportTicket';
export * from './support/Macro';

// Shared domain (Moved to migrated-models)
