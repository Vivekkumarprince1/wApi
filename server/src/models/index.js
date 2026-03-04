/**
 * MODELS INDEX
 * Centralized exports for all models
 */

// Auth domain
const User = require('./auth/User');
const Permission = require('./auth/Permission');
const Plan = require('./auth/Plan');

// Workspace domain
const Workspace = require('./workspace/Workspace');
const Subscription = require('./workspace/Subscription');
const InternalNote = require('./workspace/InternalNote');

// Messaging domain
const Contact = require('./messaging/Contact');
const Conversation = require('./messaging/Conversation');
const ConversationLedger = require('./messaging/ConversationLedger');
const Message = require('./messaging/Message');
const Tag = require('./messaging/Tag');
const WhatsAppForm = require('./messaging/WhatsAppForm');
const WhatsAppFormResponse = require('./messaging/WhatsAppFormResponse');

// Commerce domain
const Product = require('./commerce/Product');
const CheckoutCart = require('./commerce/CheckoutCart');
const Order = require('./commerce/Order');
const Deal = require('./commerce/Deal');
const Invoice = require('./commerce/Invoice');
const Pipeline = require('./commerce/Pipeline');
const CommerceSettings = require('./commerce/CommerceSettings');

// Campaign domain
const Campaign = require('./campaign/Campaign');
const CampaignBatch = require('./campaign/CampaignBatch');
const CampaignMessage = require('./campaign/CampaignMessage');
const CampaignSummary = require('./campaign/CampaignSummary');

// Template domain
const Template = require('./template/Template');
const TemplateMetric = require('./template/TemplateMetric');

// Analytics domain
const DailyAnalytics = require('./analytics/DailyAnalytics');
const AgentDailyAnalytics = require('./analytics/AgentDailyAnalytics');
const UsageLedger = require('./analytics/UsageLedger');
const WhatsAppAd = require('./analytics/WhatsAppAd');

// Automation domain
const AutomationRule = require('./automation/AutomationRule');
const AutomationExecution = require('./automation/AutomationExecution');
const AutoReply = require('./automation/AutoReply');
const AutoReplyLog = require('./automation/AutoReplyLog');
const AutomationAuditLog = require('./automation/AutomationAuditLog');
const AnswerBotSource = require('./automation/AnswerBotSource');
const WorkflowExecution = require('./automation/WorkflowExecution');

// Integration domain
const Integration = require('./integration/Integration');
const InstagramQuickflow = require('./integration/InstagramQuickflow');
const InstagramQuickflowLog = require('./integration/InstagramQuickflowLog');
const WidgetConfig = require('./integration/WidgetConfig');

// BSP domain
const BspHealth = require('./bsp/BspHealth');
const WebhookLog = require('./bsp/WebhookLog');

// Admin domain
const AuditLog = require('./admin/AuditLog');

// Shared domain
const FAQ = require('./shared/FAQ');

module.exports = {
  // Auth domain
  User,
  Permission,
  Plan,

  // Workspace domain
  Workspace,
  Subscription,
  InternalNote,

  // Messaging domain
  Contact,
  Conversation,
  ConversationLedger,
  Message,
  Tag,
  WhatsAppForm,
  WhatsAppFormResponse,

  // Commerce domain
  Product,
  CheckoutCart,
  Order,
  Deal,
  Invoice,
  Pipeline,
  CommerceSettings,

  // Campaign domain
  Campaign,
  CampaignBatch,
  CampaignMessage,
  CampaignSummary,

  // Template domain
  Template,
  TemplateMetric,

  // Analytics domain
  DailyAnalytics,
  AgentDailyAnalytics,
  UsageLedger,
  WhatsAppAd,

  // Automation domain
  AutomationRule,
  AutomationExecution,
  AutoReply,
  AutoReplyLog,
  AutomationAuditLog,
  AnswerBotSource,
  WorkflowExecution,

  // Integration domain
  Integration,
  InstagramQuickflow,
  InstagramQuickflowLog,
  WidgetConfig,

  // BSP domain
  BspHealth,
  WebhookLog,

  // Admin domain
  AuditLog,

  // Shared domain
  FAQ
};