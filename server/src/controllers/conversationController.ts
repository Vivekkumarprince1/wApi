import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Conversation, Message, Team, Contact, Permission, Pipeline } from '../models';
import * as SocketService from '../services/socket-service';
import { WabaService } from '../services/messaging/waba-service';
import { BspServiceClient } from '../services/microservices/bsp-service-client';

export const conversationController = {
  /**
   * List conversations (Inbox)
   */
  async getInbox(req: AuthRequest, res: Response) {
    try {
      const { user, workspace } = req;
      const view = req.query.view as string || "mine";
      const statusParam = req.query.status as string;
      const sessionParam = req.query.session as string;
      const channel = req.query.channel as string;
      const search = req.query.search as string;
      const page = parseInt(req.query.page as string || "1", 10);
      const limit = parseInt(req.query.limit as string || "50", 10);

      const [permission, userTeams] = await Promise.all([
        Permission.findOne({ workspace: workspace._id, user: user._id }).lean(),
        (Team as any).findByUser(workspace._id, user._id)
      ]);

      // Use the workspace-scoped role (Permission.role), not the global
      // User.role. The previous logic mistreated workspace owners/admins as
      // plain members whenever User.role was the default.
      const workspaceRole = (permission as any)?.role || req.role;
      const isSuperAdmin = user.role === 'super_admin';
      const hasAllAccess = isSuperAdmin
        || ['owner', 'admin', 'manager'].includes(workspaceRole)
        || (permission as any)?.permissions?.viewAllConversations;
      const userTeamIds = userTeams.map((t: any) => t._id);

      const query: any = { workspace: workspace._id };

      if (view === 'mine') {
        query.assignedTo = user._id;
        query.status = { $ne: 'spam' };
      } else if (view === 'unassigned') {
        query.assignedTo = null;
        query.status = { $ne: 'spam' };
        if (!hasAllAccess) {
          if (userTeamIds.length > 0) {
            query.team = { $in: userTeamIds };
          } else {
            query.team = null;
          }
        }
      } else if (view === 'team') {
        if (userTeamIds.length > 0) {
          const leadTeamIds = userTeams
            .filter((t: any) => t.members.some((m: any) => m.user.toString() === user._id.toString() && m.role === 'lead'))
            .map((t: any) => t._id);

          if (hasAllAccess || leadTeamIds.length > 0) {
            const targetTeamIds = hasAllAccess ? userTeamIds : leadTeamIds;
            const memberIds = [...new Set(userTeams.filter((t: any) => targetTeamIds.includes(t._id)).flatMap((t: any) => t.members.map((m: any) => m.user.toString())))];
            query.$or = [{ assignedTo: { $in: memberIds } }, { team: { $in: targetTeamIds } }];
            query.status = { $ne: 'spam' };
          } else {
            query.assignedTo = user._id; 
          }
        } else {
          query.assignedTo = user._id;
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
            const memberIds = [...new Set(userTeams.flatMap((t: any) => t.members.map((m: any) => m.user.toString())))];
            query.$or = [{ assignedTo: { $in: memberIds } }, { team: { $in: userTeamIds } }];
          } else {
            return res.status(403).json({ success: false, message: "Permission denied" });
          }
        }
      }

      if (statusParam && statusParam !== 'all') {
        query.status = statusParam;
      } else if (!['resolved', 'snoozed', 'spam', 'all'].includes(view)) {
        query.status = { $in: ['open', 'pending'] };
      }

      if (channel) query.channel = channel;
      if (sessionParam === 'open') {
        query.isOpen = true;
        query.windowExpiresAt = { $gt: new Date() };
      }

      if (search) {
        // Prefer MongoDB $text when indexes exist (workspace-scoped compound
        // text on Message.body / Contact.name). Fall back to bounded regex for
        // phone-like queries or when $text errors (e.g. bad operator syntax).
        const SEARCH_HIT_CAP = Number(process.env.INBOX_SEARCH_HIT_CAP || 200);
        const trimmed = String(search).trim();
        const mostlyDigits = /^[\d\s\-+()]{6,}$/.test(trimmed);
        const useText = process.env.INBOX_TEXT_SEARCH !== '0' && trimmed.length > 0 && !mostlyDigits;

        let matchingMessages: unknown[] = [];
        let matchingContacts: unknown[] = [];

        if (useText) {
          try {
            const safeText = trimmed.replace(/[^\p{L}\p{N}\s@-]/gu, ' ').slice(0, 256);
            if (safeText.length > 0) {
              const [msgConv, contactIds] = await Promise.all([
                Message.find({
                  workspace: workspace._id,
                  $text: { $search: safeText },
                })
                  .limit(SEARCH_HIT_CAP)
                  .select('conversation')
                  .distinct('conversation'),
                Contact.find({
                  workspace: workspace._id,
                  $text: { $search: safeText },
                })
                  .limit(SEARCH_HIT_CAP)
                  .select('_id')
                  .distinct('_id'),
              ]);
              matchingMessages = msgConv;
              matchingContacts = contactIds;
            }
          } catch {
            matchingMessages = [];
            matchingContacts = [];
          }
        }

        if (matchingMessages.length === 0 && matchingContacts.length === 0) {
          const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const searchRegex = { $regex: escaped, $options: 'i' };
          const [msgConv2, contactIds2] = await Promise.all([
            Message.find({ workspace: workspace._id, body: searchRegex })
              .limit(SEARCH_HIT_CAP)
              .select('conversation')
              .distinct('conversation'),
            Contact.find({
              workspace: workspace._id,
              $or: [{ name: searchRegex }, { phone: searchRegex }],
            })
              .limit(SEARCH_HIT_CAP)
              .select('_id')
              .distinct('_id'),
          ]);
          matchingMessages = msgConv2;
          matchingContacts = contactIds2;
        }

        query.$or = [
          ...(query.$or || []),
          { contact: { $in: matchingContacts } },
          { _id: { $in: matchingMessages } },
        ];
      }

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

      const userIdStr = user._id.toString();
      const enrichedConversations = conversations.map((conv: any) => {
        const unreadCounts = conv.agentUnreadCounts || {};
        return {
          ...conv,
          myUnreadCount: unreadCounts instanceof Map ? unreadCounts.get(userIdStr) || 0 : unreadCounts[userIdStr] || 0
        };
      });

      res.json({
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
      res.status(500).json({ success: false, message: "Failed to fetch conversations", error: err.message });
    }
  },
  
  /**
   * Mark conversation as read
   */
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const { conversationId } = req.params;
      const userId = req.user._id;
      const userIdStr = userId.toString();

      const conversation = await Conversation.findOne({ _id: conversationId, workspace: req.workspace._id }).populate('contact');
      if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

      const contact = (conversation as any).contact;

      // Reset global unread count if it was assigned to this user
      if (conversation.assignedTo?.toString() === userIdStr) {
        conversation.unreadCount = 0;
      }

      // Reset per-agent unread counts
      if (conversation.agentUnreadCounts) {
        conversation.agentUnreadCounts.set(userIdStr, 0);
      }

      await conversation.save();

      // Mark all inbound messages in this conversation as 'read'
      const now = new Date();
      const result = await Message.updateMany(
        {
          workspace: req.workspace._id,
          conversation: conversationId,
          direction: 'inbound',
          status: { $ne: 'read' }
        },
        {
          $set: {
            status: 'read',
            readAt: now
          }
        }
      );

      // Broadcast status updates for all messages that were marked as read
      if (result.modifiedCount > 0) {
        const unreadMessages = await Message.find({
          workspace: req.workspace._id,
          conversation: conversationId,
          direction: 'inbound',
          status: 'read',
          readAt: now
        }).select('_id whatsappMessageId');

        for (const msg of unreadMessages) {
          await SocketService.emitStatusUpdate(
            req.workspace._id.toString(),
            conversationId,
            msg._id.toString(),
            'read',
            now
          );
        }
        console.log(`[Conversation] Marked ${result.modifiedCount} inbound messages as read for conversation ${conversationId}`);

        // Sync "Read" status to WhatsApp (Gupshup V3)
        // Find the latest inbound message that has a provider ID to mark it as read on their side
        const lastInbound = await Message.findOne({
          conversation: conversationId,
          direction: 'inbound',
          whatsappMessageId: { $ne: null }
        }).sort({ createdAt: -1 });

        if (lastInbound?.whatsappMessageId) {
          try {
            const { appId } = await WabaService.resolveWorkspaceConfig(req.workspace._id);
            const customerPhone = contact?.phone || (lastInbound as any).recipientPhone || (lastInbound as any).from;
            
            if (appId && customerPhone) {
              console.log(`[Conversation] Syncing READ status to WhatsApp for message ${lastInbound.whatsappMessageId}`);
              // Fire and forget - don't block the user interface for provider latency
              BspServiceClient.providerAction({
                workspaceId: req.workspace._id.toString(),
                appId,
                action: 'mark_read',
                payload: {
                  customerPhone,
                  messageId: lastInbound.whatsappMessageId
                }
              }).catch(err => console.error("[Conversation] WhatsApp Read Sync Failed:", err.message));
            }
          } catch (configErr: any) {
            console.warn("[Conversation] Skipping WhatsApp Read Sync: Workspace not fully configured or not BSP managed", configErr.message);
          }
        }
      }

      res.json({ success: true, markedAsReadCount: result.modifiedCount });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  },

  /**
   * Cold Start Bootstrap
   */
  async getBootstrapData(req: AuthRequest, res: Response) {
    try {
      const { user, workspace } = req;
      
      const [permission, userTeams, allTeams, pipelines] = await Promise.all([
        Permission.findOne({ workspace: workspace._id, user: user._id }).lean(),
        (Team as any).findByUser(workspace._id, user._id),
        Team.find({ workspace: workspace._id }).populate('members.user', 'name email').lean(),
        Pipeline.find({ workspace: workspace._id }).select('name stages').lean()
      ]);

      // Workspace-scoped role drives RBAC; super_admin bypasses.
      const workspaceRole = (permission as any)?.role || req.role;
      const hasAllAccess = user.role === 'super_admin'
        || ['owner', 'admin', 'manager'].includes(workspaceRole)
        || (permission as any)?.permissions?.viewAllConversations;
      
      const leadTeamIds = userTeams
        .filter((t: any) => t.members.some((m: any) => m.user.toString() === user._id.toString() && m.role === 'lead'))
        .map((t: any) => t._id);

      const initialQuery: any = { 
        workspace: workspace._id,
        status: { $in: ['open', 'pending'] }
      };

      if (hasAllAccess) {
         initialQuery.assignedTo = user._id;
      } else {
         initialQuery.$or = [
            { assignedTo: user._id },
            { assignedTo: null, team: { $in: leadTeamIds } }
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

      const agentsMap = new Map();
      allTeams.forEach((team: any) => {
        team.members?.forEach((m: any) => {
          if (m.user) agentsMap.set(m.user._id.toString(), m.user);
        });
      });
      const agents = Array.from(agentsMap.values());

      const userIdStr = user._id.toString();
      const enrichedConversations = initialConversations.map((conv: any) => {
        const unreadCounts = conv.agentUnreadCounts || {};
        return {
          ...conv,
          myUnreadCount: unreadCounts instanceof Map ? unreadCounts.get(userIdStr) || 0 : unreadCounts[userIdStr] || 0
        };
      });

      res.json({
        success: true,
        data: {
          conversations: {
            data: enrichedConversations,
            pagination: { total: enrichedConversations.length, page: 1, limit: 50, pages: 1 }
          },
          agents,
          teams: allTeams,
          pipelines,
          metadata: { 
            hasAllAccess,
            userTeamIds: userTeams.map((t: any) => t._id),
            totalInitial: enrichedConversations.length
          }
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Bootstrap failed", error: err.message });
    }
  }
};
