import { Types } from "mongoose";
import { Conversation, Permission, Workspace, Team, User } from "../../models";
import dbConnect from "../../db-connect";
import { IConversationDocument } from "../../models/messaging/Conversation";

export type AssignmentStrategy = 'ROUND_ROBIN' | 'LEAST_ASSIGNED' | 'LEAST_UNREAD';

export class AutoAssignService {
  /**
   * Main entry point to assign a conversation
   */
  static async assign(workspaceId: string | Types.ObjectId, conversationId: string | Types.ObjectId, force = false) {
    await dbConnect();

    // 1. Fetch Workspace & Settings
    const workspace = await Workspace.findById(workspaceId).select('inboxSettings');
    if (!workspace) throw new Error("Workspace not found");

    if (!workspace.inboxSettings.autoAssignmentEnabled && !force) {
      return { success: false, reason: 'AUTO_ASSIGNMENT_DISABLED' };
    }

    // 2. Fetch Conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.assignedTo && !force) return { success: false, reason: 'ALREADY_ASSIGNED' };

    // 3. Determine Strategy and Scope
    let strategy: AssignmentStrategy = workspace.inboxSettings.assignmentStrategy as AssignmentStrategy || 'ROUND_ROBIN';
    let targetTeamId = conversation.team;

    // Team override
    if (targetTeamId) {
      const team = await Team.findById(targetTeamId);
      if (team?.autoAssign?.enabled) {
        strategy = team.autoAssign.strategy.toUpperCase() as AssignmentStrategy;
      }
    }

    // 4. Get Available Agents
    const availableAgents = await this.getAvailableAgents(workspaceId, targetTeamId);
    if (availableAgents.length === 0) {
      return { success: false, reason: 'NO_AVAILABLE_AGENTS' };
    }

    // 5. Select Agent based on Strategy
    let selectedAgentId: Types.ObjectId | null = null;
    
    switch (strategy) {
      case 'LEAST_ASSIGNED':
        selectedAgentId = await this.selectLeastAssigned(availableAgents);
        break;
      case 'LEAST_UNREAD':
        selectedAgentId = await this.selectLeastUnread(availableAgents);
        break;
      case 'ROUND_ROBIN':
      default:
        selectedAgentId = await this.selectRoundRobin(workspaceId, availableAgents);
        break;
    }

    if (!selectedAgentId) return { success: false, reason: 'SELECTION_FAILED' };

    // 6. Execute Assignment
    conversation.assignTo(selectedAgentId, 'system' as any); // Use 'system' as internal marker
    await conversation.save();

    console.log(`[AutoAssign] ✅ Assigned ${conversationId} to ${selectedAgentId} via ${strategy}`);
    
    return { success: true, agentId: selectedAgentId, strategy };
  }

  /**
   * Helper: Get available agents with their current load
   */
  private static async getAvailableAgents(workspaceId: string | Types.ObjectId, teamId?: Types.ObjectId) {
    const query: any = {
      workspace: workspaceId,
      isActive: true,
      isAvailable: true,
      isOnline: true
    };

    const permissions = await Permission.find(query).populate('user');
    
    const agentsWithLoad = await Promise.all(permissions.map(async (p) => {
      const [openCount, userTeams] = await Promise.all([
        Conversation.countDocuments({
          workspace: workspaceId,
          assignedTo: p.user,
          status: { $in: ['open', 'pending'] }
        }),
        Team.find({
           workspace: workspaceId,
           'members.user': (p.user as any)._id,
           isActive: true
        }).select('_id').lean()
      ]);

      // Calculate total unread count across all assigned open conversations
      const conversations = await Conversation.find({
        workspace: workspaceId,
        assignedTo: p.user,
        status: { $in: ['open', 'pending'] }
      }).select('agentUnreadCounts').lean();

      const userIdStr = (p.user as any)._id.toString();
      const totalUnread = conversations.reduce((acc, conv) => {
         const counts = conv.agentUnreadCounts || {};
         const count = counts instanceof Map ? counts.get(userIdStr) : counts[userIdStr];
         return acc + (Number(count) || 0);
      }, 0);

      return {
        userId: p.user._id as Types.ObjectId,
        openCount,
        maxChats: p.maxConcurrentChats || 10,
        teamIds: userTeams.map(t => t._id.toString()),
        unreadCount: totalUnread
      };
    }));

    // Filter by team if scoped
    let filtered = agentsWithLoad;
    if (teamId) {
      const targetTeamIdStr = teamId.toString();
      filtered = agentsWithLoad.filter(a => a.teamIds.includes(targetTeamIdStr));
    }

    // Filter by capacity
    return filtered.filter(a => a.openCount < a.maxChats);
  }

  /**
   * Strategy: Round Robin
   */
  private static async selectRoundRobin(workspaceId: string | Types.ObjectId, agents: any[]) {
    const workspace = await Workspace.findById(workspaceId).select('inboxSettings');
    const lastIndex = workspace?.inboxSettings?.lastAssignedAgentIndex || 0;
    
    // Find matching agent after lastIndex cycle
    const nextIndex = (lastIndex + 1) % agents.length;
    const selected = agents[nextIndex];

    await Workspace.findByIdAndUpdate(workspaceId, { 
      'inboxSettings.lastAssignedAgentIndex': nextIndex 
    });

    return selected.userId;
  }

  /**
   * Strategy: Least Assigned
   */
  private static async selectLeastAssigned(agents: any[]) {
    const sorted = [...agents].sort((a, b) => a.openCount - b.openCount);
    return sorted[0].userId;
  }

  /**
   * Strategy: Least Unread
   */
  private static async selectLeastUnread(agents: any[]) {
    const sorted = [...agents].sort((a, b) => a.unreadCount - b.unreadCount);
    return sorted[0].userId;
  }
}

