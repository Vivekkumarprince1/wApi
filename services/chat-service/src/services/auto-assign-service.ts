import mongoose, { Types } from 'mongoose';
import { Conversation, Permission, Team } from '../models/index.js';

export type AssignmentStrategy = 'ROUND_ROBIN' | 'LEAST_ASSIGNED' | 'LEAST_UNREAD';

/**
 * Auto-assignment of inbound conversations to available agents.
 * Port of the monolith's AutoAssignService — same strategies, same
 * availability filters (isActive + isAvailable + isOnline + capacity),
 * driven by workspace.inboxSettings. Workspace docs live in the shared
 * `connectsphere` DB and are owned by auth-service, so we read/update them via
 * the raw collection (same pattern as chatController).
 */
export class AutoAssignService {
  private static workspaces() {
    return Conversation.db.useDb('connectsphere').collection('workspaces');
  }

  static async assign(workspaceId: string | Types.ObjectId, conversationId: string | Types.ObjectId, force = false) {
    const wsId = new mongoose.Types.ObjectId(workspaceId.toString());
    const workspace = await this.workspaces().findOne(
      { _id: wsId },
      { projection: { inboxSettings: 1 } }
    );
    if (!workspace) throw new Error('Workspace not found');

    if (!workspace.inboxSettings?.autoAssignmentEnabled && !force) {
      return { success: false, reason: 'AUTO_ASSIGNMENT_DISABLED' };
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error('Conversation not found');
    if (conversation.assignedTo && !force) return { success: false, reason: 'ALREADY_ASSIGNED' };

    let strategy: AssignmentStrategy =
      (workspace.inboxSettings?.assignmentStrategy as AssignmentStrategy) || 'ROUND_ROBIN';
    const targetTeamId = conversation.team;

    if (targetTeamId) {
      const team: any = await Team.findById(targetTeamId);
      if (team?.autoAssign?.enabled) {
        strategy = String(team.autoAssign.strategy).toUpperCase() as AssignmentStrategy;
      }
    }

    const availableAgents = await this.getAvailableAgents(wsId, targetTeamId);
    if (availableAgents.length === 0) {
      return { success: false, reason: 'NO_AVAILABLE_AGENTS' };
    }

    let selectedAgentId: Types.ObjectId | null = null;
    switch (strategy) {
      case 'LEAST_ASSIGNED':
        selectedAgentId = this.selectLeastAssigned(availableAgents);
        break;
      case 'LEAST_UNREAD':
        selectedAgentId = this.selectLeastUnread(availableAgents);
        break;
      case 'ROUND_ROBIN':
      default:
        selectedAgentId = await this.selectRoundRobin(wsId, availableAgents);
        break;
    }

    if (!selectedAgentId) return { success: false, reason: 'SELECTION_FAILED' };

    (conversation as any).assignTo(selectedAgentId, 'system' as any);
    await conversation.save();

    console.log(`[AutoAssign] ✅ Assigned ${conversationId} to ${selectedAgentId} via ${strategy}`);
    return { success: true, agentId: selectedAgentId, strategy };
  }

  private static async getAvailableAgents(workspaceId: Types.ObjectId, teamId?: Types.ObjectId) {
    const permissions = await Permission.find({
      workspace: workspaceId,
      isActive: true,
      isAvailable: true,
      isOnline: true,
    }).populate('user');

    const agentsWithLoad = await Promise.all(
      permissions.map(async (p: any) => {
        const [openCount, userTeams] = await Promise.all([
          Conversation.countDocuments({
            workspace: workspaceId,
            assignedTo: p.user,
            status: { $in: ['open', 'pending'] },
          }),
          Team.find({
            workspace: workspaceId,
            'members.user': p.user._id,
            isActive: true,
          })
            .select('_id')
            .lean(),
        ]);

        const conversations = await Conversation.find({
          workspace: workspaceId,
          assignedTo: p.user,
          status: { $in: ['open', 'pending'] },
        })
          .select('agentUnreadCounts')
          .lean();

        const userIdStr = p.user._id.toString();
        const totalUnread = conversations.reduce((acc: number, conv: any) => {
          const counts = conv.agentUnreadCounts || {};
          const count = counts instanceof Map ? counts.get(userIdStr) : counts[userIdStr];
          return acc + (Number(count) || 0);
        }, 0);

        return {
          userId: p.user._id as Types.ObjectId,
          openCount,
          maxChats: p.maxConcurrentChats || 10,
          teamIds: userTeams.map((t: any) => t._id.toString()),
          unreadCount: totalUnread,
        };
      })
    );

    let filtered = agentsWithLoad;
    if (teamId) {
      const targetTeamIdStr = teamId.toString();
      filtered = agentsWithLoad.filter((a) => a.teamIds.includes(targetTeamIdStr));
    }

    return filtered.filter((a) => a.openCount < a.maxChats);
  }

  private static async selectRoundRobin(workspaceId: Types.ObjectId, agents: any[]) {
    const workspace = await this.workspaces().findOne(
      { _id: workspaceId },
      { projection: { 'inboxSettings.lastAssignedAgentIndex': 1 } }
    );
    const lastIndex = workspace?.inboxSettings?.lastAssignedAgentIndex || 0;
    const nextIndex = (lastIndex + 1) % agents.length;
    const selected = agents[nextIndex];

    await this.workspaces().updateOne(
      { _id: workspaceId },
      { $set: { 'inboxSettings.lastAssignedAgentIndex': nextIndex } }
    );

    return selected.userId;
  }

  private static selectLeastAssigned(agents: any[]) {
    const sorted = [...agents].sort((a, b) => a.openCount - b.openCount);
    return sorted[0].userId;
  }

  private static selectLeastUnread(agents: any[]) {
    const sorted = [...agents].sort((a, b) => a.unreadCount - b.unreadCount);
    return sorted[0].userId;
  }
}
