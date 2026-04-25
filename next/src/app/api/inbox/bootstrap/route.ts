/**
 * API: /api/inbox/bootstrap
 * Optimized "Cold Start" endpoint for the Shared Inbox.
 * Combines Teams, Agents, Pipelines, and Initial Conversations into a single request.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Conversation, Team, User, Pipeline, Permission } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withFeature('INBOX', async (req: NextRequest, { user, workspace }) => {
  try {
    await dbConnect();

    // 1. Concurrent Fetch of Metadata
    const [userPermission, userTeams, allTeams, pipelines] = await Promise.all([
      Permission.findOne({ workspace: workspace._id, user: user._id }).lean(),
      Team.findByUser(workspace._id, user._id),
      Team.find({ workspace: workspace._id }).populate('members.user', 'name email').lean(),
      Pipeline.find({ workspace: workspace._id }).select('name stages').lean()
    ]);

    const hasAllAccess = ['owner', 'admin', 'manager'].includes(user.role) || userPermission?.permissions?.viewAllConversations;
    const userTeamIds = userTeams.map(t => t._id);
    
    // Find teams where user is a Lead
    const leadTeamIds = userTeams
      .filter(t => t.members.some(m => m.user.toString() === user._id.toString() && m.role === 'lead'))
      .map(t => t._id);

    // 2. Fetch Initial Conversations (mine + lead teams unassigned)
    const initialQuery: any = { 
      workspace: workspace._id,
      status: { $in: ['open', 'pending'] }
    };

    if (hasAllAccess) {
       // Owners/Admins see their own assigned by default for bootstrap, 
       // but we'll stick to 'mine' parity for now as the dashboard starts in 'mine' view.
       initialQuery.assignedTo = user._id;
    } else {
       initialQuery.$or = [
          { assignedTo: user._id },
          { 
             assignedTo: null, 
             team: { $in: leadTeamIds } 
          }
       ];
    }


    const initialConversations = await Conversation.find(initialQuery)
      .select('contact assignedTo team channel status priority unreadCount agentUnreadCounts lastActivityAt lastMessageAt lastMessagePreview lastMessageType lastMessageDirection isOpen windowExpiresAt createdAt updatedAt')
      .populate('contact', 'name phone email profilePicture avatar tags')
      .populate('assignedTo', 'name email')
      .populate('team', 'name')
      .sort({ lastActivityAt: -1 })
      .limit(50)
      .lean();

    // 3. Extract Unique Agents from all teams
    const agentsMap = new Map();
    allTeams.forEach(team => {
      team.members?.forEach((m: any) => {
        if (m.user) {
          agentsMap.set(m.user._id.toString(), m.user);
        }
      });
    });
    const agents = Array.from(agentsMap.values());

    // Enrich conversations with myUnreadCount
    const userIdStr = user._id.toString();
    const enrichedConversations = initialConversations.map((conv: any) => {
      const unreadCounts = conv.agentUnreadCounts || {};
      return {
        ...conv,
        myUnreadCount: unreadCounts instanceof Map 
          ? unreadCounts.get(userIdStr) || 0 
          : unreadCounts[userIdStr] || 0
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        conversations: {
          data: enrichedConversations,
          pagination: {
            total: enrichedConversations.length,
            page: 1,
            limit: 50,
            pages: 1
          }
        },
        agents,
        teams: allTeams,
        pipelines,
        metadata: {
          hasAllAccess,
          userTeamIds,
          totalInitial: enrichedConversations.length
        }
      }
    });

  } catch (err: any) {
    console.error("[Inbox Bootstrap API Error]:", err.message);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to bootstrap inbox", 
      error: err.message 
    }, { status: 500 });
  }
});
