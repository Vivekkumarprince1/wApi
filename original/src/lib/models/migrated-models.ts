import mongoose, { Schema } from 'mongoose';

/**
 * MIGRATED MODELS PLACEHOLDERS
 * These satisfy legacy monolith imports after the domain was moved to the microservice.
 */

const MigratedSchema = new Schema({}, { strict: false, timestamps: true });

// Automation Domain
export const AutomationRule = mongoose.models.AutomationRule || mongoose.model('AutomationRule', MigratedSchema);
export const AutomationExecution = mongoose.models.AutomationExecution || mongoose.model('AutomationExecution', MigratedSchema);
export const AutoReply = mongoose.models.AutoReply || mongoose.model('AutoReply', MigratedSchema);
export const AutoReplyLog = mongoose.models.AutoReplyLog || mongoose.model('AutoReplyLog', MigratedSchema);
export const AutomationAuditLog = mongoose.models.AutomationAuditLog || mongoose.model('AutomationAuditLog', MigratedSchema);
export const AnswerBotSource = mongoose.models.AnswerBotSource || mongoose.model('AnswerBotSource', MigratedSchema);
export const AnswerBotSettings = mongoose.models.AnswerBotSettings || mongoose.model('AnswerBotSettings', MigratedSchema);
export const WorkflowExecution = mongoose.models.WorkflowExecution || mongoose.model('WorkflowExecution', MigratedSchema);
export const AiIntentMatchLog = mongoose.models.AiIntentMatchLog || mongoose.model('AiIntentMatchLog', MigratedSchema);
export const InteraktiveList = mongoose.models.InteraktiveList || mongoose.model('InteraktiveList', MigratedSchema);

// Integration Domain (Moved to automation)
export const InstagramQuickflow = mongoose.models.InstagramQuickflow || mongoose.model('InstagramQuickflow', MigratedSchema);
export const InstagramQuickflowLog = mongoose.models.InstagramQuickflowLog || mongoose.model('InstagramQuickflowLog', MigratedSchema);
export const FAQ = mongoose.models.FAQ || mongoose.model('FAQ', MigratedSchema);

// Campaign Domain (Moved to campaign-service)
export const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', MigratedSchema);
export const CampaignBatch = mongoose.models.CampaignBatch || mongoose.model('CampaignBatch', MigratedSchema);
export const CampaignMessage = mongoose.models.CampaignMessage || mongoose.model('CampaignMessage', MigratedSchema);
export const CampaignSummary = mongoose.models.CampaignSummary || mongoose.model('CampaignSummary', MigratedSchema);
export const Segment = mongoose.models.Segment || mongoose.model('Segment', MigratedSchema);

// Billing Domain (Moved to billing-service)
export const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', MigratedSchema);
export const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', MigratedSchema);
export const WalletTransaction = mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', MigratedSchema);
