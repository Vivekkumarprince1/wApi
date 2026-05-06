import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Message, Conversation, Contact } from '../models';
import { InboxService } from '../services/messaging/inbox-service';
import * as SocketService from '../services/socket-service';
import { logActivity } from '../services/activity-logging-service';

export const messageController = {
  /**
   * Get message history for a contact
   */
  async getMessages(req: AuthRequest, res: Response, next: any) {
    try {
      const { conversationId, contactId } = req.params;
      const workspaceId = req.workspace._id;
      const limit = parseInt(req.query.limit as string || "50");
      const before = req.query.before as string;

      const query: any = { workspace: workspaceId, isInternalNote: false };
      if (conversationId) query.conversation = conversationId;
      else if (contactId) query.contact = contactId;
      else return res.status(400).json({ message: "Missing conversationId or contactId" });

      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }

      console.log(`[getMessages] Query:`, JSON.stringify(query));

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);

      console.log(`[getMessages] Found ${messages.length} messages for conversation ${conversationId || contactId}`);

      const total = await Message.countDocuments({
        workspace: workspaceId,
        conversation: conversationId || query.conversation,
        isInternalNote: false
      });

      const hasMore = total > (messages.length + (before ? limit : 0)); // Rough estimate or just check limit
      // More accurate hasMore:
      const actualHasMore = messages.length === limit;
      
      const lastTimestamp = messages.length > 0 ? messages[messages.length - 1].createdAt : null;

      res.json({
        success: true,
        data: messages.reverse(), // Return oldest first for the frontend to append correctly
        pagination: {
          total,
          hasMore: actualHasMore,
          lastTimestamp
        }
      });
    } catch (err: any) {
      res.status(500).json({ message: "Server Error", error: err.message });
    }
  },

  /**
   * Get message history by contact ID
   */
  async getMessagesByContact(req: AuthRequest, res: Response, next: any) {
    try {
      const { contactId } = req.params;
      const workspaceId = req.workspace._id;
      const limit = parseInt(req.query.limit as string || "50");
      const before = req.query.before as string;

      const query: any = { workspace: workspaceId, contact: contactId, isInternalNote: false };
      
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);

      const actualHasMore = messages.length === limit;
      const lastTimestamp = messages.length > 0 ? messages[messages.length - 1].createdAt : null;

      res.json({
        success: true,
        data: messages.reverse(),
        pagination: {
          hasMore: actualHasMore,
          lastTimestamp
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Send a message to a contact
   */
  async sendMessage(req: AuthRequest, res: Response, next: any) {
    try {
      const { conversationId, contactId } = req.params;
      const { user, workspace } = req as any;
      const { body, isInternalNote, type = 'text', template, media } = req.body;
      const socketId = req.headers['x-socket-id'] as string;

      if (!body && type === 'text') {
        return res.status(400).json({ message: "Message body is required" });
      }

      let conversation;
      if (conversationId) {
        conversation = await Conversation.findOne({ _id: conversationId, workspace: workspace._id });
      } else if (contactId) {
        conversation = await Conversation.findOne({ workspace: workspace._id, contact: contactId });
      }

      if (!conversation) return res.status(404).json({ message: "Conversation not found" });

      if (isInternalNote) {
        const newMessage = await Message.create({
          workspace: workspace._id,
          conversation: conversation._id,
          contact: conversation.contact,
          direction: 'outbound',
          type: 'note',
          body,
          isInternalNote: true,
          sentBy: user._id,
          status: 'received',
          sentAt: new Date(),
        });

        await Conversation.findByIdAndUpdate(conversation._id, {
          $set: {
            lastMessageAt: new Date(),
            lastMessagePreview: body.substring(0, 100),
            lastMessageDirection: 'outbound',
            lastMessageType: 'note',
            lastActivityAt: new Date(),
          }
        });

        // Log activity
        await logActivity(req, 'create', 'message', {
          entityId: newMessage._id.toString(),
          metadata: { conversationId: conversation._id, type: 'note', isInternal: true }
        });

        // Emit socket event
        SocketService.emitMessageSent(workspace._id.toString(), conversation._id.toString(), newMessage, user, socketId);

        return res.json({ success: true, message: "Internal note added", data: newMessage });
      }

      if (type === 'template' && template) {
        const result = await InboxService.sendTemplateMessage({
          workspaceId: workspace._id.toString(),
          conversationId: conversation._id.toString(),
          agentId: user._id.toString(),
          templateName: template.name,
          languageCode: template.language || 'en',
          variables: template.variables || [],
          socketId
        });

        // Log activity
        await logActivity(req, 'send', 'message', {
          entityId: (result as any).message._id.toString(),
          metadata: { conversationId: conversation._id, type: 'template', templateName: template.name }
        });

        return res.json({ success: true, message: "Template sent", data: (result as any).message });
      }

      if (['image', 'video', 'audio', 'document', 'sticker'].includes(type) && media?.url) {
        const result = await InboxService.sendMediaMessage({
          workspaceId: workspace._id.toString(),
          conversationId: conversation._id.toString(),
          agentId: user._id.toString(),
          type: type as any,
          mediaUrl: media.url,
          mimeType: media.mimeType,
          caption: media.caption || body,
          filename: media.filename,
          socketId
        });

        // Log activity
        await logActivity(req, 'send', 'message', {
          entityId: (result as any).message._id.toString(),
          metadata: { conversationId: conversation._id, type, mediaUrl: media.url }
        });

        return res.json({ success: true, message: "Media sent", data: (result as any).message });
      }

      // Channel-specific text sending
      let result;
      if (conversation.channel === 'sms') {
        result = await InboxService.sendSmsMessage({
          workspaceId: workspace._id.toString(),
          conversationId: conversation._id.toString(),
          agentId: user._id.toString(),
          text: body
        });
      } else if (conversation.channel === 'email') {
        result = await InboxService.sendEmailMessage({
          workspaceId: workspace._id.toString(),
          conversationId: conversation._id.toString(),
          agentId: user._id.toString(),
          subject: req.body.subject || 'Message from support',
          html: req.body.emailHtml || body
        });
      } else {
        result = await InboxService.sendTextMessage({
          workspaceId: workspace._id.toString(),
          conversationId: conversation._id.toString(),
          agentId: user._id.toString(),
          text: body,
          socketId
        });
      }

      // Log activity
      await logActivity(req, 'send', 'message', {
        entityId: (result as any).message._id.toString(),
        metadata: { conversationId: conversation._id, type: 'text' }
      });

      res.json({ success: true, message: "Message sent", data: (result as any).message });
    } catch (err: any) {
      console.error("[Send Message API Error]:", err.message);
      res.status(500).json({ message: "Server Error", error: err.message });
    }
  },

  /**
   * Get shared inbox conversations
   */
  async getInbox(req: AuthRequest, res: Response, next: any) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try {
      console.log(`[getInbox] Incoming request at ${new Date().toISOString()}`);
      const { user, workspace } = req;
      const { Team, Permission, Message, Contact, Conversation } = await import('../models');

      const view = req.query.view as string || "mine";
      const statusParam = req.query.status as string;
      const sessionParam = req.query.session as string;
      const channel = req.query.channel as string;
      const search = req.query.search as string;
      const page = parseInt(req.query.page as string || "1");
      const limit = parseInt(req.query.limit as string || "50");

      const [permission, userTeams] = await Promise.all([
        Permission.findOne({ workspace: workspace._id, user: user._id }).lean(),
        Team.findByUser(workspace._id, user._id)
      ]);

      const hasAllAccess = ['owner', 'admin', 'manager'].includes(user.role) || (permission as any)?.permissions?.viewAllConversations;
      const userTeamIds = userTeams.map(t => t._id);

      const query: any = { workspace: workspace._id };

      if (view === 'mine') {
        query.assignedTo = user._id;
        query.status = { $ne: 'spam' };
      } else if (view === 'unassigned') {
        query.assignedTo = null;
        query.status = { $ne: 'spam' };
        if (!hasAllAccess) {
          if (userTeamIds.length > 0) query.team = { $in: userTeamIds };
          else query.team = null;
        }
      } else if (view === 'team') {
        if (userTeamIds.length > 0) {
          const leadTeamIds = userTeams
            .filter(t => t.members.some((m: any) => m.user.toString() === user._id.toString() && m.role === 'lead'))
            .map(t => t._id);

          if (hasAllAccess || leadTeamIds.length > 0) {
            const targetTeamIds = hasAllAccess ? userTeamIds : leadTeamIds;
            const memberIds = [...new Set(userTeams.filter(t => targetTeamIds.includes(t._id)).flatMap(t => t.members.map((m: any) => m.user.toString())))];
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
              const memberIds = [...new Set(userTeams.flatMap(t => t.members.map((m: any) => m.user.toString())))];
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
        const searchRegex = { $regex: search, $options: 'i' };
        const [matchingMessages, matchingContacts] = await Promise.all([
          Message.find({ workspace: workspace._id, body: searchRegex }).limit(500).distinct('conversation'),
          Contact.find({ workspace: workspace._id, $or: [{ name: searchRegex }, { phone: searchRegex }] }).limit(500).distinct('_id')
        ]);

        query.$or = [
          ...(query.$or || []),
          { contact: { $in: matchingContacts } },
          { _id: { $in: matchingMessages } }
        ];
      }

      console.log(`[getInbox] User: ${user.email}, Role: ${req.role || user.role}, Workspace: ${workspace._id}`);
      console.log(`[getInbox] Final Query:`, JSON.stringify(query));

      const [conversations, total] = await Promise.all([
        Conversation.find(query)
          .populate('contact', 'name phone email profilePicture avatar tags')
          .populate('assignedTo', 'name email')
          .populate('team', 'name')
          .sort({ lastActivityAt: -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Conversation.countDocuments(query)
      ]);

      console.log(`[getInbox] Found ${conversations.length} conversations for workspace ${workspace._id}`);

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
        pagination: { total, page, limit, pages: Math.ceil(total / limit) }
      });
    } catch (err: any) {
      console.error("[Inbox API Error]:", err.message);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Bootstrap Inbox (Cold Start)
   */
  async bootstrapInbox(req: AuthRequest, res: Response, next: any) {
    try {
      const { user, workspace } = req;
      const { Team, Pipeline, Permission } = await import('../models');

      const [userPermission, userTeams, allTeams, pipelines] = await Promise.all([
        Permission.findOne({ workspace: workspace._id, user: user._id }).lean(),
        Team.findByUser(workspace._id, user._id),
        Team.find({ workspace: workspace._id }).populate('members.user', 'name email').lean(),
        Pipeline.find({ workspace: workspace._id }).select('name stages').lean()
      ]);

      const hasAllAccess = ['owner', 'admin', 'manager'].includes(user.role) || (userPermission as any)?.permissions?.viewAllConversations;
      const leadTeamIds = userTeams
        .filter(t => t.members.some((m: any) => m.user.toString() === user._id.toString() && m.role === 'lead'))
        .map(t => t._id);

      const initialQuery: any = { 
        workspace: workspace._id,
        status: { $in: ['open', 'pending'] },
        assignedTo: user._id
      };

      const initialConversations = await Conversation.find(initialQuery)
        .populate('contact', 'name phone email profilePicture tags')
        .populate('assignedTo', 'name email')
        .populate('team', 'name')
        .sort({ lastActivityAt: -1 })
        .limit(50)
        .lean();

      const agentsMap = new Map();

      // Collect from Permissions
      const memberships = await Permission.find({ workspace: workspace._id, isActive: { $ne: false } }).populate('user', 'name email role status').lean();
      memberships.forEach((m: any) => {
        if (m.user) {
          agentsMap.set(m.user._id.toString(), {
            ...m.user,
            role: m.role || m.user.role
          });
        }
      });

      // Collect from Teams
      allTeams.forEach(team => {
        team.members?.forEach((m: any) => {
          if (m.user) {
            const userIdStr = m.user._id.toString();
            if (!agentsMap.has(userIdStr)) {
              agentsMap.set(userIdStr, {
                ...m.user,
                role: m.role || 'member'
              });
            }
          }
        });
      });

      res.json({
        success: true,
        data: {
          conversations: { data: initialConversations, pagination: { total: initialConversations.length, page: 1, limit: 50, pages: 1 } },
          agents: Array.from(agentsMap.values()),
          teams: allTeams,
          pipelines,
          metadata: { hasAllAccess, userTeamIds: userTeams.map(t => t._id) }
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Perform Action on Conversation (Assign, Status Change, etc.)
   */
  async performConversationAction(req: AuthRequest, res: Response, next: any) {
    try {
      const { conversationId } = req.params;
      const { action, data = {} } = req.body;
      const { user, workspace } = req;
      const { Conversation, Team } = await import('../models');

      const conversation = await Conversation.findOne({ _id: conversationId, workspace: workspace._id });
      if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

      console.log(`[performAction] Conversation: ${conversationId}, Action: ${action}`, data);

      switch (action) {
        case 'assign':
        case 'claim':
          const targetAgentId = action === 'claim' ? user._id : data.agentId;
          if (!targetAgentId) return res.status(400).json({ message: "Agent ID is required for assignment" });

          // 1. Fetch Agent Settings (Permission record)
          const { Permission } = await import('../models');
          const agentPerm = await Permission.findOne({ workspace: workspace._id, user: targetAgentId });
          
          if (agentPerm) {
             const maxChats = (agentPerm as any).maxConcurrentChats || 10;
             const currentChats = await Conversation.countDocuments({
               workspace: workspace._id,
               assignedTo: targetAgentId,
               status: { $in: ['open', 'pending'] }
             });

             if (currentChats >= maxChats) {
               return res.status(400).json({ 
                 success: false, 
                 message: `Agent has reached maximum capacity (${maxChats} chats).` 
               });
             }
          }

          (conversation as any).assignTo(targetAgentId, user._id);
          
          // 2. Dispatch notification to the assigned agent
          const { NotificationService } = await import('../services/notification-service');
          if (targetAgentId.toString() !== user._id.toString()) {
            await NotificationService.notify({
              workspaceId: workspace._id,
              recipientId: targetAgentId,
              type: 'assignment',
              title: 'New Conversation Assigned',
              body: `You have been assigned to a conversation.`,
              link: `/dashboard/inbox/${conversation._id}`
            }).catch(e => console.warn("[Action:Assign] Notification failed:", e.message));
          }
          break;

        case 'unassign':
          (conversation as any).unassign(user._id);
          break;

        case 'assignToTeam':
          if (!data.teamId) return res.status(400).json({ message: "Team ID is required" });
          conversation.team = data.teamId;
          break;

        case 'resolve':
        case 'close':
          (conversation as any).updateStatus('resolved', user._id);
          break;

        case 'open':
        case 'reopen':
          (conversation as any).updateStatus('open', user._id);
          break;

        case 'snooze':
          if (!data.until) return res.status(400).json({ message: "Snooze duration required" });
          (conversation as any).updateStatus('snoozed', user._id);
          conversation.snoozedUntil = new Date(data.until);
          break;

        case 'spam':
          (conversation as any).updateStatus('spam', user._id);
          break;

        case 'label':
          conversation.label = data.label;
          break;

        case 'priority':
          conversation.priority = data.priority;
          break;

        default:
          return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
      }

      conversation.lastActivityAt = new Date();
      await conversation.save();

      // Log activity
      await logActivity(req, 'update', 'conversation', {
        entityId: conversation._id.toString(),
        metadata: { action, ...data }
      });

      // Emit socket event for real-time UI updates
      SocketService.emitConversationUpdated(
        workspace._id.toString(),
        conversation._id.toString(),
        conversation.toObject ? conversation.toObject() : conversation
      );

      res.json({ success: true, data: conversation });
    } catch (err: any) {
      console.error("[Conversation Action Error]:", err.message);
      res.status(500).json({ success: false, message: "Action failed", error: err.message });
    }
  }
};
