import {
  User,
  Workspace,
  Campaign,
  CampaignBatch,
  CampaignMessage,
  CampaignSummary,
  Segment,
  Contact,
  ContactEvent,
  Conversation,
  ConversationLedger,
  Message,
  QuickReply,
  Tag,
  WhatsAppForm,
  WhatsAppFormResponse,
  Template,
  TemplateMetric,
  AutomationRule,
  AutomationExecution,
  AutoReply,
  AutoReplyLog,
  AutomationAuditLog,
  AnswerBotSource,
  AnswerBotSettings,
  WorkflowExecution,
  AiIntentMatchLog,
  InteraktiveList,
  Business,
  BusinessAppMap,
  GupshupApp,
  OnboardingState,
  InternalNote,
  Team,
  WorkspaceInvitation,
  DailyAnalytics,
  AgentDailyAnalytics,
  UsageLedger,
  WhatsAppAd,
  AuditLog,
  WorkspaceIntegration,
  WidgetConfig,
  BspHealth,
  WebhookLog,
  Deal,
  Pipeline,
  Product,
  Task
} from '@/lib/models';
import { GupshupPartnerService } from '@/lib/services/bsp/gupshup-partner-service';
import mongoose from 'mongoose';

export class AccountDeletionService {
  /**
   * Performs a comprehensive deletion of a user account and all owned workspaces.
   */
  static async deleteAccount(userId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // 1. Find all workspaces owned by the user
      const ownedWorkspaces = await Workspace.find({ owner: userId }).session(session);

      for (const workspace of ownedWorkspaces) {
        await this.deleteWorkspaceInternal(workspace, session);
      }

      // 2. Remove user from other teams (where they are not the owner)
      await Team.updateMany(
        { 'members.user': userId },
        { $pull: { members: { user: userId } } }
      ).session(session);

      // 3. Delete user record
      await User.findByIdAndDelete(userId).session(session);

      await session.commitTransaction();
      console.log(`[AccountDeletion] Successfully deleted account for user ${userId}`);
    } catch (error) {
      await session.abortTransaction();
      console.error(`[AccountDeletion] Failed to delete account for user ${userId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Deletes a specific workspace and all its associated data.
   */
  static async deleteWorkspace(workspaceId: string, ownerId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const workspace = await Workspace.findOne({ _id: workspaceId, owner: ownerId }).session(session);
      if (!workspace) {
        throw new Error('Workspace not found or unauthorized');
      }

      await this.deleteWorkspaceInternal(workspace, session);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Internal helper for workspace deletion logic
   */
  private static async deleteWorkspaceInternal(workspace: any, session: mongoose.ClientSession) {
    const workspaceId = workspace._id;
    const gupshupAppId = workspace.gupshupAppId || workspace.gupshupIdentity?.partnerAppId;

    console.log(`[AccountDeletion] Purging workspace ${workspaceId} (${workspace.name})...`);

    // 1. Gupshup Integration Cleanup
    if (gupshupAppId && !String(gupshupAppId).startsWith('mock_')) {
      try {
        console.log(`[AccountDeletion] Cleaning up Gupshup app ${gupshupAppId}...`);

        // Remove all webhooks for this app
        const subscriptions = await GupshupPartnerService.listSubscriptions(gupshupAppId).catch(() => []);
        if (Array.isArray(subscriptions)) {
          for (const sub of subscriptions) {
            const subId = sub.id || sub.subscriptionId || sub.data?.id;
            if (subId) {
              await GupshupPartnerService.deleteSubscription(gupshupAppId, subId).catch(err => {
                console.warn(`[AccountDeletion] Failed to delete Gupshup subscription ${subId}:`, err.message);
              });
              // Rate limiting protection
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        // Return app to pool if sandbox, or mark as disconnected
        const gApp = await GupshupApp.findOne({ gupshupAppId }).session(session);
        if (gApp) {
          gApp.assigned = false;
          gApp.assignedToWorkspace = undefined;
          gApp.assignedToBusiness = undefined;
          gApp.status = 'disconnected';
          await gApp.save({ session });
        }

        // Deactivate BusinessAppMap
        await BusinessAppMap.updateMany(
          { workspace: workspaceId, gupshupAppId },
          { $set: { active: false, disconnectedAt: new Date() } }
        ).session(session);

      } catch (error: any) {
        console.error(`[AccountDeletion] Gupshup cleanup failed for workspace ${workspaceId}:`, error.message);
        // We continue anyway to ensure database cleanup
      }
    }

    // 2. Recursive PURGE of all linked models
    // We group them by priority or category
    const modelsToPurge = [
      // Messaging
      { model: Contact, field: 'workspace' },
      { model: ContactEvent, field: 'workspace' },
      { model: Conversation, field: 'workspace' },
      { model: ConversationLedger, field: 'workspace' },
      { model: Message, field: 'workspace' },
      { model: QuickReply, field: 'workspace' },
      { model: Tag, field: 'workspace' },
      { model: WhatsAppForm, field: 'workspace' },
      { model: WhatsAppFormResponse, field: 'workspace' },

      // Campaigns
      { model: Campaign, field: 'workspace' },
      { model: CampaignBatch, field: 'workspace' },
      { model: CampaignMessage, field: 'workspace' },
      { model: CampaignSummary, field: 'workspace' },
      { model: Segment, field: 'workspace' },

      // Templates
      { model: Template, field: 'workspace' },
      { model: TemplateMetric, field: 'workspace' },

      // Automation
      { model: AutomationRule, field: 'workspace' },
      { model: AutomationExecution, field: 'workspace' },
      { model: AutoReply, field: 'workspace' },
      { model: AutoReplyLog, field: 'workspace' },
      { model: AutomationAuditLog, field: 'workspace' },
      { model: AnswerBotSource, field: 'workspace' },
      { model: AnswerBotSettings, field: 'workspace' },
      { model: WorkflowExecution, field: 'workspace' },
      { model: AiIntentMatchLog, field: 'workspace' },
      { model: InteraktiveList, field: 'workspace' },

      // Commerce
      { model: Deal, field: 'workspace' },
      { model: Pipeline, field: 'workspace' },
      { model: Product, field: 'workspace' },
      { model: Task, field: 'workspace' },

      // Analytics
      { model: DailyAnalytics, field: 'workspace' },
      { model: AgentDailyAnalytics, field: 'workspace' },
      { model: UsageLedger, field: 'workspace' },
      { model: WhatsAppAd, field: 'workspace' },

      // Integrations & Misc
      { model: WorkspaceIntegration, field: 'workspace' },
      { model: WidgetConfig, field: 'workspace' },
      { model: Business, field: 'workspace' },
      { model: OnboardingState, field: 'workspace' },
      { model: InternalNote, field: 'workspace' },
      { model: Team, field: 'workspace' },
      { model: WorkspaceInvitation, field: 'workspace' },
      { model: WebhookLog, field: 'workspace' },
    ];

    try {
      await Promise.all(
        modelsToPurge.map(({ model, field }) =>
          (model as any).deleteMany({ [field]: workspaceId }).session(session)
        )
      );

      // Finally delete the workspace itself
      await Workspace.deleteOne({ _id: workspaceId }).session(session);

      console.log(`[AccountDeletion] Finished purging workspace ${workspaceId}`);
    } catch (error: any) {
      console.error(`[AccountDeletion] Database purge failed for workspace ${workspaceId}:`, error.message);
      throw error;
    }
  }
}
