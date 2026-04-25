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
export * from './workspace/Subscription';
export * from './workspace/InternalNote';
export * from './workspace/Team';
export * from './workspace/WorkspaceInvitation';


// Messaging domain
export * from './messaging/Contact';
export * from './messaging/Conversation';
export * from './messaging/ConversationLedger';
export * from './messaging/Message';
export * from './messaging/Tag';
export * from './messaging/WhatsAppForm';
export * from './messaging/WhatsAppFormResponse';
export * from './messaging/QuickReply';
export * from './messaging/ContactEvent';
export * from './messaging/WhatsAppFlow';

// Commerce domain
export * from './commerce/Pipeline';
export * from './commerce/Deal';
export * from './commerce/Task';
export * from './commerce/Product';
export * from './commerce/CheckoutCart';
export * from './commerce/Order';
export * from './commerce/Invoice';
export * from './commerce/CommerceSettings';

// Billing domain
export * from './billing/WalletTransaction';

// Onboarding domain
export * from './onboarding/Business';
export * from './onboarding/GupshupApp';
export * from './onboarding/BusinessAppMap';
export * from './onboarding/OnboardingState';

// Campaign domain
export * from './campaign/Campaign';
export * from './campaign/CampaignBatch';
export * from './campaign/CampaignMessage';
export * from './campaign/CampaignSummary';
export * from './campaign/Segment';

// Template domain

export * from './template/Template';
export * from './template/TemplateMetric';

// Analytics domain
export * from './analytics/DailyAnalytics';
export * from './analytics/AgentDailyAnalytics';
export * from './analytics/UsageLedger';
export * from './analytics/WhatsAppAd';

// Automation domain
export { AutomationRule } from './automation/AutomationRule';
export * from './automation/AutomationRule';
export * from './automation/AutomationExecution';
export * from './automation/AutoReply';
export * from './automation/AutoReplyLog';
export * from './automation/AutomationAuditLog';
export * from './automation/AnswerBotSource';
export * from './automation/AnswerBotSettings';
export * from './automation/WorkflowExecution';
export * from './automation/AiIntentMatchLog';
export * from './automation/InteraktiveList';

// Integration domain
export * from './integration/Integration';
export * from './integration/IntegrationApp';
export * from './integration/WorkspaceIntegration';
export * from './integration/InstagramQuickflow';
export * from './integration/InstagramQuickflowLog';
export * from './integration/WidgetConfig';

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

// Shared domain
export * from './shared/FAQ';
