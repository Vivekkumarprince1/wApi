import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import * as Models from '@/lib/models';
import { withRole } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';

const WORKSPACE_PURGE_MODELS = [
  'Subscription',
  'InternalNote',
  'Team',
  'WorkspaceInvitation',
  'Permission',
  'Role',
  'Contact',
  'Conversation',
  'ConversationLedger',
  'Message',
  'Tag',
  'WhatsAppForm',
  'WhatsAppFormResponse',
  'QuickReply',
  'ContactEvent',
  'Pipeline',
  'Deal',
  'Task',
  'Product',
  'CheckoutCart',
  'Order',
  'Invoice',
  'CommerceSettings',
  'Campaign',
  'CampaignBatch',
  'CampaignMessage',
  'CampaignSummary',
  'Segment',
  'Template',
  'TemplateMetric',
  'DailyAnalytics',
  'AgentDailyAnalytics',
  'UsageLedger',
  'WhatsAppAd',
  'WalletTransaction',
  'AutomationRule',
  'AutomationExecution',
  'AutoReply',
  'AutoReplyLog',
  'AutomationAuditLog',
  'AnswerBotSource',
  'AnswerBotSettings',
  'WorkflowExecution',
  'AiIntentMatchLog',
  'InteraktiveList',
  'Integration',
  'WorkspaceIntegration',
  'InstagramQuickflow',
  'InstagramQuickflowLog',
  'WidgetConfig',
  'AuditLog',
  'FAQ',
] as const;

function getModel(modelName: string) {
  return (Models as Record<string, any>)[modelName];
}

function withSessionOptions(session: mongoose.ClientSession) {
  return { session };
}

async function deleteByWorkspace(modelName: string, workspaceId: mongoose.Types.ObjectId, session: mongoose.ClientSession) {
  const model = getModel(modelName);
  if (!model?.deleteMany) {
    return 0;
  }

  const result = await model.deleteMany({ workspace: workspaceId }, withSessionOptions(session));
  return result.deletedCount || 0;
}

async function purgeWorkspace(workspace: any, session: mongoose.ClientSession) {
  const workspaceId = workspace._id;
  const stats: Record<string, number> = {};

  for (const modelName of WORKSPACE_PURGE_MODELS) {
    stats[modelName] = await deleteByWorkspace(modelName, workspaceId, session);
  }

  const gupshupAppModel = getModel('GupshupApp');
  if (gupshupAppModel?.deleteMany) {
    const gupshupFilters: Array<Record<string, unknown>> = [{ assignedToWorkspace: workspaceId }];

    if (workspace.gupshupAppId) {
      gupshupFilters.push({ gupshupAppId: workspace.gupshupAppId });
    }

    if (workspace.gupshupIdentity?.partnerAppId) {
      gupshupFilters.push({ gupshupAppId: workspace.gupshupIdentity.partnerAppId });
    }

    if (workspace.whatsappPhoneNumberId) {
      gupshupFilters.push({ phoneNumberId: workspace.whatsappPhoneNumberId });
    }

    const result = await gupshupAppModel.deleteMany(
      { $or: gupshupFilters },
      withSessionOptions(session)
    );
    stats.GupshupApp = result.deletedCount || 0;
  }

  const businessAppMapModel = getModel('BusinessAppMap');
  if (businessAppMapModel?.deleteMany) {
    const result = await businessAppMapModel.deleteMany({ workspace: workspaceId }, withSessionOptions(session));
    stats.BusinessAppMap = result.deletedCount || 0;
  }

  const businessModel = getModel('Business');
  if (businessModel?.deleteOne) {
    const result = await businessModel.deleteOne({ workspace: workspaceId }, withSessionOptions(session));
    stats.Business = result.deletedCount || 0;
  }

  const onboardingStateModel = getModel('OnboardingState');
  if (onboardingStateModel?.deleteMany) {
    const result = await onboardingStateModel.deleteMany({ workspace: workspaceId }, withSessionOptions(session));
    stats.OnboardingState = result.deletedCount || 0;
  }

  const userModel = getModel('User');
  if (userModel?.deleteMany) {
    const result = await userModel.deleteMany({ workspace: workspaceId }, withSessionOptions(session));
    stats.User = result.deletedCount || 0;
  }

  const workspaceModel = getModel('Workspace');
  const workspaceDelete = await workspaceModel.deleteOne({ _id: workspaceId }, withSessionOptions(session));
  stats.Workspace = workspaceDelete.deletedCount || 0;

  return stats;
}

export const DELETE = withRole(['super_admin'], async (req: NextRequest, { params }) => {
  await dbConnect();

  const { id: workspaceId } = await params;
  const workspace = await Models.Workspace.findById(workspaceId);

  if (!workspace) {
    return NextResponse.json({ message: 'Workspace not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const confirmName = String(
    body?.confirmName || req.nextUrl.searchParams.get('confirmName') || ''
  ).trim();

  if (confirmName !== workspace.name) {
    return NextResponse.json(
      { message: 'Confirmation name does not match workspace name' },
      { status: 400 }
    );
  }

  const session = await mongoose.startSession();
  try {
    let cleanupStats: Record<string, number> = {};

    await session.withTransaction(async () => {
      cleanupStats = await purgeWorkspace(workspace, session);
    });

    return NextResponse.json({
      success: true,
      message: 'Workspace and all associated records deleted successfully',
      cleanupStats,
    });
  } catch (error: any) {
    console.error('[SuperAdmin Workspace Delete Error]:', error?.message || error);
    return NextResponse.json(
      { message: 'Failed to delete workspace', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}) as any;