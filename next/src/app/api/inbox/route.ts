/**
 * API: /api/inbox
 * Port of legacy inboxController.getInbox
 * Fetches workspace conversations for the shared inbox with omnichannel support.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Conversation, Message, Team, Contact, Permission } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { Types } from "mongoose";

export const GET = withFeature('INBOX', async (req: NextRequest, { user, workspace }) => {
  try {
    await dbConnect();

    // Parse query params
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view") || "mine";
    const statusParam = searchParams.get("status");
    const sessionParam = searchParams.get("session");
    const channel = searchParams.get("channel");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // 1. Fetch user permissions and teams
    const [permission, userTeams] = await Promise.all([
      Permission.findOne({ workspace: workspace._id, user: user._id }).lean(),
      Team.findByUser(workspace._id, user._id)
    ]);

    const hasAllAccess = ['owner', 'admin', 'manager'].includes(user.role) || permission?.permissions?.viewAllConversations;
    const userTeamIds = userTeams.map(t => t._id);

    // 2. Build query based on view (Parity with wApi legacy logic)
    const query: any = { workspace: workspace._id };

    if (view === 'mine') {
      query.assignedTo = user._id;
      query.status = { $ne: 'spam' };
    } else if (view === 'unassigned') {
      query.assignedTo = null;
      query.status = { $ne: 'spam' };

      // Team isolation for unassigned
      if (!hasAllAccess) {
        if (userTeamIds.length > 0) {
          query.team = { $in: userTeamIds };
        } else {
          query.team = null; // Teamless agents see teamless unassigned
        }
      }
    } else if (view === 'team') {
      if (userTeamIds.length > 0) {
        // Find which teams the user is a Lead in
        const leadTeamIds = userTeams
          .filter(t => t.members.some(m => m.user.toString() === user._id.toString() && m.role === 'lead'))
          .map(t => t._id);

        if (hasAllAccess || leadTeamIds.length > 0) {
          // If they have global access or lead at least one team, show team-wide data
          const targetTeamIds = hasAllAccess ? userTeamIds : leadTeamIds;
          const memberIds = [...new Set(userTeams.filter(t => targetTeamIds.includes(t._id)).flatMap(t => t.members.map(m => m.user.toString())))];
          
          query.$or = [
            { assignedTo: { $in: memberIds } },
            { team: { $in: targetTeamIds } }
          ];
          query.status = { $ne: 'spam' };
        } else {
          // Regular member - only sees their own team chats but scoped to members? 
          // Legacy: Fallback to mine + specifically team-scoped unassigned handled in 'unassigned' view
          query.assignedTo = user._id; 
        }
      } else {
        query.assignedTo = user._id; // Fallback to mine
      }
    } else if (view === 'resolved') {

      query.status = { $in: ['closed', 'resolved'] };
    } else if (view === 'snoozed') {
      query.status = 'snoozed';
    } else if (view === 'spam') {
      query.status = 'spam';
    } else if (view === 'all') {
      if (!hasAllAccess) {
        if (userTeamIds.length > 0) {
          const memberIds = [...new Set(userTeams.flatMap(t => t.members.map(m => m.user.toString())))];
          query.$or = [
            { assignedTo: { $in: memberIds } },
            { team: { $in: userTeamIds } }
          ];
        } else {
          return NextResponse.json({ success: false, message: "Permission denied" }, { status: 403 });
        }
      }
    }

    // Status override
    if (statusParam && statusParam !== 'all') {
      query.status = statusParam;
    } else if (!['resolved', 'snoozed', 'spam', 'all'].includes(view)) {
      // Default for active views
      query.status = { $in: ['open', 'pending'] };
    }

    if (channel) {
      query.channel = channel;
    }

    // Session filter: `open` means WhatsApp 24h customer-care window is active.
    if (sessionParam === 'open') {
      query.isOpen = true;
      query.windowExpiresAt = { $gt: new Date() };
    }

    // Advanced search (Optimized with limits to prevent full collection scans)
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      
      // Check messages and contacts (Limited to 500 initial matches for performance)
      const [matchingMessages, matchingContacts] = await Promise.all([
        Message.find({ workspace: workspace._id, body: searchRegex }).limit(500).select('conversation').distinct('conversation'),
        Contact.find({ workspace: workspace._id, $or: [{ name: searchRegex }, { phone: searchRegex }] }).limit(500).select('_id').distinct('_id')
      ]);

      query.$or = [
        ...(query.$or || []),
        { contact: { $in: matchingContacts } },
        { _id: { $in: matchingMessages } }
      ];
    }

    // 3. Fetch conversations
    const skip = (page - 1) * limit;
    const [conversations, total] = await Promise.all([
      Conversation.find(query)
        .select('contact assignedTo team channel status priority unreadCount agentUnreadCounts lastActivityAt lastMessageAt lastMessagePreview lastMessageType lastMessageDirection isOpen windowExpiresAt createdAt updatedAt')
        .populate('contact', 'name phone email profilePicture avatar tags')
        .populate('assignedTo', 'name email')
        .populate('team', 'name')
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Conversation.countDocuments(query)
    ]);

    // 4. Enrich with myUnreadCount (Parity with legacy)
    const userIdStr = user._id.toString();
    const enrichedConversations = conversations.map((conv: any) => {
      // agentUnreadCounts is a Map in the model, but lean() converts it to a plain object
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
      data: enrichedConversations,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (err: any) {
    console.error("[Inbox API Error]:", err.message);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch conversations", 
      error: err.message 
    }, { status: 500 });
  }
});
