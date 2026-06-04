import axios from 'axios';
import {
  User,
  Workspace,
  Permission,
  Business,
  Team,
  WorkspaceInvitation,
  Notification
} from '../models/index.js';
import { config } from '../config/index.js';
import { BspServiceClient } from './bsp-service-client.js';

async function purgeMicroserviceWorkspaceData(workspaceId: string) {
  const purgeTargets = [
    { name: 'automation', url: process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3007', path: `/api/automation/internal/purge/${workspaceId}` },
    { name: 'campaign', url: process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:3008', path: `/api/campaign/internal/purge/${workspaceId}` },
  ];

  for (const { name, url, path } of purgeTargets) {
    try {
      await axios.delete(`${url.replace(/\/$/, '')}${path}`, {
        headers: {
          'x-internal-service': 'auth-service',
          'x-internal-service-secret': config.internalServiceSecret
        },
        timeout: 5000,
        validateStatus: () => true
      });
      console.log(`[AccountDeletion] Purged ${name} data for workspace ${workspaceId}`);
    } catch (error: any) {
      console.warn(`[AccountDeletion] ${name} purge unreachable for workspace ${workspaceId}:`, error.message);
    }
  }
}

async function cleanupBspApp(workspaceId: string, gupshupAppId?: string) {
  if (!gupshupAppId || String(gupshupAppId).startsWith('mock_')) return;
  try {
    await BspServiceClient.request({
      method: 'DELETE',
      path: `/internal/v1/bsp/apps/${encodeURIComponent(gupshupAppId)}`,
      workspaceId
    });
    console.log(`[AccountDeletion] Cleaned up BSP app ${gupshupAppId}`);
  } catch (error: any) {
    console.warn(`[AccountDeletion] Failed to delete BSP app ${gupshupAppId}:`, error.message);
  }
}

async function deleteWorkspaceInternal(workspace: any) {
  const workspaceId = workspace._id;

  await Promise.all([
    Permission.deleteMany({ workspace: workspaceId }),
    Business.deleteMany({ workspace: workspaceId }),
    Team.deleteMany({ workspace: workspaceId }),
    WorkspaceInvitation.deleteMany({ workspace: workspaceId }),
    Notification.deleteMany({ workspace: workspaceId })
  ]);

  await Workspace.deleteOne({ _id: workspaceId });
  console.log(`[AccountDeletion] Purged workspace ${workspaceId}`);
}

export class AccountDeletionService {
  static async deleteAccount(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }

    const ownedWorkspaces = await Workspace.find({ owner: userId });

    for (const workspace of ownedWorkspaces) {
      await purgeMicroserviceWorkspaceData(workspace._id.toString());
      await cleanupBspApp(workspace._id.toString(), (workspace as any).gupshupAppId);
    }

    for (const workspace of ownedWorkspaces) {
      await deleteWorkspaceInternal(workspace);
    }

    await Team.updateMany(
      { 'members.user': userId },
      { $pull: { members: { user: userId } } }
    );

    await Permission.deleteMany({ user: userId });
    await User.findByIdAndDelete(userId);

    console.log(`[AccountDeletion] Successfully deleted account for user ${userId}`);
  }

  static async deleteWorkspace(workspaceId: string, ownerId?: string) {
    const query: any = { _id: workspaceId };
    if (ownerId) query.owner = ownerId;
    const workspace = await Workspace.findOne(query);
    if (!workspace) {
      throw Object.assign(new Error('Workspace not found or unauthorized'), { status: 404 });
    }

    await purgeMicroserviceWorkspaceData(workspaceId);
    await cleanupBspApp(workspaceId, (workspace as any).gupshupAppId);
    await deleteWorkspaceInternal(workspace);
  }
}
