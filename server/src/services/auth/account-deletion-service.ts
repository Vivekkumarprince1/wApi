import {
  User,
  Workspace,
  Contact,
  ContactEvent,
  Conversation,
  ConversationLedger,
  Message,
  QuickReply,
  Tag,
  Template,
  TemplateMetric,
  Business,
  BusinessAppMap,
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
  Deal,
  Pipeline,
  Product,
  Task,
  Order,
  CheckoutCart,
  FormSubmission,
  InstagramQuickflow,
  InstagramQuickflowLog,
  WhatsAppFlow,
  SupportTicket,
  Macro,
  Notification
} from '@/models';
import { BspServiceClient } from '@/services/microservices/bsp-service-client';
import { proxyController } from '@/controllers/proxyController';
import mongoose from 'mongoose';

export class AccountDeletionService {
  /**
   * Performs a comprehensive deletion of a user account and all owned workspaces.
   */
  static async deleteAccount(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const ownedWorkspaces = await Workspace.find({ owner: userId });

    // Step 1: Perform all external (non-DB) cleanups first, OUTSIDE any transaction
    // External network requests within a MongoDB transaction cause write conflicts & timeouts
    for (const workspace of ownedWorkspaces) {
      await this.cleanupExternalWorkspaceData(workspace);
    }

    // Step 2: Perform the database deletions inside a transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const workspace of ownedWorkspaces) {
        await this.deleteWorkspaceInternal(workspace, session);
      }

      // Remove user from other teams (where they are not the owner)
      await Team.updateMany(
        { 'members.user': userId },
        { $pull: { members: { user: userId } } }
      ).session(session);

      // Delete user record
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
  static async deleteWorkspace(workspaceId: string, ownerId?: string) {
    const query: any = { _id: workspaceId };
    if (ownerId) query.owner = ownerId;
    const workspace = await Workspace.findOne(query);
    if (!workspace) {
      throw new Error('Workspace not found or unauthorized');
    }

    // Perform external cleanup outside transaction
    await this.cleanupExternalWorkspaceData(workspace);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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
   * Helper to perform external API calls (Gupshup, Microservices) outside of DB transactions.
   */
  private static async cleanupExternalWorkspaceData(workspace: any) {
    const workspaceId = workspace._id;
    const gupshupAppId = workspace.gupshupAppId;

    console.log(`[AccountDeletion] Cleaning up external data for workspace ${workspaceId} (${workspace.name})...`);

    await this.purgeMicroserviceWorkspaceData(workspaceId.toString());

    if (gupshupAppId && !String(gupshupAppId).startsWith('mock_')) {
      try {
        console.log(`[AccountDeletion] Cleaning up BSP app ${gupshupAppId}...`);
        await BspServiceClient.request({
          method: 'DELETE',
          path: `/internal/v1/bsp/apps/${encodeURIComponent(gupshupAppId)}`,
          workspaceId: workspaceId.toString(),
        }).catch(err => {
          console.warn(`[AccountDeletion] Failed to delete BSP app ${gupshupAppId}:`, err.message);
        });
      } catch (error: any) {
        console.error(`[AccountDeletion] Gupshup cleanup failed for workspace ${workspaceId}:`, error.message);
      }
    }
  }

  /**
   * Internal helper for workspace database deletion logic
   */
  private static async deleteWorkspaceInternal(workspace: any, session: mongoose.ClientSession) {
    const workspaceId = workspace._id;
    const gupshupAppId = workspace.gupshupAppId;

    console.log(`[AccountDeletion] Purging database records for workspace ${workspaceId} (${workspace.name})...`);

    // Clean up local BSP mapping records inside the transaction
    if (gupshupAppId && !String(gupshupAppId).startsWith('mock_')) {
      try {
        await BusinessAppMap.updateMany(
          { workspace: workspaceId, gupshupAppId },
          { $set: { active: false, disconnectedAt: new Date() } }
        ).session(session);
      } catch (error: any) {
        console.error(`[AccountDeletion] Gupshup local db cleanup failed for workspace ${workspaceId}:`, error.message);
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

      // Templates
      { model: Template, field: 'workspace' },
      { model: TemplateMetric, field: 'workspace' },

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
      { model: InternalNote, field: 'workspace' },
      { model: Team, field: 'workspace' },
      { model: WorkspaceInvitation, field: 'workspace' },
      { model: Order, field: 'workspaceId' },
      { model: CheckoutCart, field: 'workspaceId' },
      { model: FormSubmission, field: 'workspace' },
      { model: InstagramQuickflow, field: 'workspace' },
      { model: InstagramQuickflowLog, field: 'workspace' },
      { model: WhatsAppFlow, field: 'workspace' },
      { model: SupportTicket, field: 'workspace' },
      { model: Macro, field: 'workspace' },
      { model: Notification, field: 'workspace' },
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

  private static async purgeMicroserviceWorkspaceData(workspaceId: string) {
    const purgeTargets = [
      { service: 'automation' as const, path: `/api/automation/internal/purge/${workspaceId}` },
      { service: 'campaign' as const, path: `/api/campaign/internal/purge/${workspaceId}` },
    ];

    for (const { service, path } of purgeTargets) {
      try {
        const response = await proxyController.forwardToService(service, {
          method: 'DELETE',
          path,
        });

        if (response.status >= 400) {
          console.warn(`[AccountDeletion] ${service} purge returned status ${response.status} for workspace ${workspaceId}`);
        } else {
          console.log(`[AccountDeletion] Successfully purged ${service} data for workspace ${workspaceId}`);
        }
      } catch (error: any) {
        // We log the error but do NOT re-throw. This ensures that even if a microservice is down
        // (common in local development or partial outages), the main account deletion can still finish.
        console.error(`[AccountDeletion] Skipping ${service} purge for workspace ${workspaceId} (Service unreachable):`, error.message);
      }
    }
  }
}
