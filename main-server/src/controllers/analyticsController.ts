import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import mongoose from 'mongoose';
import { 
  Template, 
  Contact, 
  Message, 
  Conversation,
  User
} from '../models';
import { proxyController } from './proxyController';

const CATEGORY_ORDER = [
  { key: "marketing_conversation", name: "Marketing", color: "#10b981" },
  { key: "utility_conversation", name: "Utility", color: "#3b82f6" },
  { key: "service_conversation", name: "Service", color: "#6366f1" },
  { key: "authentication_conversation", name: "Auth", color: "#f59e0b" },
] as const;

function clampDays(input: number) {
  if (!Number.isFinite(input)) return 30;
  return Math.max(1, Math.min(180, Math.floor(input)));
}

function getPeriodBounds(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const previousEnd = new Date(start);
  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - days);

  return { start, end, previousStart, previousEnd };
}

function pctChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function toMinutes(milliseconds: number) {
  return Math.max(0, milliseconds / 60000);
}

function formatMinutesCompact(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "-";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export const analyticsController = {
  /**
   * Get dashboard overview stats
   */
  async getDashboardOverview(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace._id;
      const ObjectId = mongoose.Types.ObjectId;

      // Time window (Last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      // 1. Static Counts & Snapshots
      const { SupportTicket, Macro, WhatsAppAd } = await import('../models');
      
      const activeCampaignStatuses = ['SCHEDULED', 'RUNNING', 'QUEUED', 'SENDING'];
      const activeCampaignsPromise = Promise.all(
        activeCampaignStatuses.map((status) =>
          proxyController.forwardToService('campaign', {
            method: 'GET',
            path: '/api/campaign/campaigns',
            params: { status, page: 1, limit: 1 },
            workspaceId: workspaceId.toString(),
            userId: req.user._id.toString(),
            userRole: req.role || req.user?.role,
          }).catch(() => null)
        )
      ).then((responses) =>
        responses.reduce((sum, response) => sum + Number(response?.data?.pagination?.total || 0), 0)
      );

      const [
        activeCampaigns,
        totalTemplates, 
        totalContacts,
        activeAds,
        openTickets,
        totalMacros
      ] = await Promise.all([
        activeCampaignsPromise,
        Template.countDocuments({
          workspace: workspaceId,
          status: { $ne: 'DELETED' }
        }),
        Contact.countDocuments({
          workspace: workspaceId
        }),
        WhatsAppAd.countDocuments({
          workspace: workspaceId,
          status: 'ACTIVE'
        }),
        SupportTicket.countDocuments({
          workspace: workspaceId,
          status: { $in: ['open', 'pending'] }
        }),
        Macro.countDocuments({
          workspace: workspaceId
        })
      ]);

      // 2. Message Performance (Last 30 Days)
      const messageStats = await Message.aggregate([
        {
          $match: {
            workspace: new ObjectId(workspaceId),
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: "$direction",
            total: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
            read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } }
          }
        }
      ]);

      const outbound = messageStats.find(s => s._id === 'outbound') || { total: 0, delivered: 0, read: 0, failed: 0 };
      const inbound = messageStats.find(s => s._id === 'inbound') || { total: 0 };

      // 3. Conversation Resolution
      const conversationStats = await Conversation.aggregate([
        {
          $match: {
            workspace: new ObjectId(workspaceId),
            statusChangedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ]);

      const resolved = conversationStats.find(s => s._id === 'resolved')?.count || 0;

      // 4. Recent Activity (Last 10 Messages)
      const recentMessages = await Message.find({ workspace: workspaceId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('contact', 'name phone email avatar')
        .lean();

      const recentActivity = recentMessages.map((m: any) => ({
        id: m._id,
        type: 'message',
        direction: m.direction,
        body: m.body,
        status: m.status,
        timestamp: m.createdAt,
        contact: m.contact ? {
          name: m.contact.name || m.contact.phone,
          phone: m.contact.phone,
          avatar: m.contact.avatar
        } : null
      }));

      // 5. Automation Summary (from microservice)
      const automationSummaryPromise = proxyController.forwardToService('automation', {
        method: 'GET',
        path: '/api/automation/hub/summary',
        workspaceId: workspaceId.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      }).catch(() => ({ data: { success: true, data: {} } }));

      const [automationRes] = await Promise.all([automationSummaryPromise]);
      const autoSummary = automationRes.data?.data || {};

      // 6. Mapping to Dashboard Expected Schema
      const deliveryRate = outbound.total > 0 ? (outbound.delivered / outbound.total) * 100 : 0;
      const readRate = outbound.delivered > 0 ? (outbound.read / outbound.delivered) * 100 : 0;

      res.json({
        success: true,
        data: {
          totalContacts,
          messages: {
             totalOutbound: outbound.total || 0,
             totalInbound: (inbound as any)?.total || 0,
             deliveryRate: Math.round(deliveryRate * 100) / 100,
             readRate: Math.round(readRate * 100) / 100
          },
          activeCampaigns,
          totalTemplates,
          activeAds,
          automation: {
            workflows: autoSummary.workflowsCount || 0,
            autoReplies: autoSummary.autoRepliesCount || 0,
            aiIntents: autoSummary.aiIntentsCount || 0,
            answerBotEnabled: !!autoSummary.answerBot?.enabled
          },
          support: {
            openTickets,
            totalMacros
          },
          conversations: {
            resolved
          },
          recentActivity
        }
      });
    } catch (err: any) {
      console.error("[Dashboard Overview API Error]:", err.message);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Get detailed message metrics
   */
  async getMessageMetrics(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace._id;
      const ObjectId = mongoose.Types.ObjectId;
      const days = parseInt(req.query.days as string || "7", 10);
      const since = new Date();
      since.setDate(since.getDate() - days);

      const [byDay, byStatus, recentOutbound] = await Promise.all([
        Message.aggregate([
          { $match: { workspace: new ObjectId(workspaceId), createdAt: { $gte: since } } },
          {
            $group: {
              _id: {
                day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                direction: '$direction'
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.day': 1 } }
        ]),
        Message.aggregate([
          { $match: { workspace: new ObjectId(workspaceId), createdAt: { $gte: since } } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Message.find({
          workspace: workspaceId,
          direction: 'outbound',
          createdAt: { $gte: since }
        }).select('recipientPhone status failureReason').lean()
      ]);

      const statusMap: any = byStatus.reduce((acc: any, s: any) => {
        acc[s._id] = s.count;
        return acc;
      }, {});

      const accepted = (statusMap.queued || 0) + (statusMap.sent || 0) + (statusMap.delivered || 0) + (statusMap.read || 0);
      const confirmedDelivered = (statusMap.delivered || 0) + (statusMap.read || 0);
      const deliveryRate = accepted > 0 ? (confirmedDelivered / accepted) * 100 : 0;
      const failureRate = accepted > 0 ? ((statusMap.failed || 0) / accepted) * 100 : 0;

      res.json({
        success: true,
        data: {
          deliveryHealth: {
            accepted,
            confirmedDelivered,
            deliveryRate: Math.round(deliveryRate * 100) / 100,
            failureRate: Math.round(failureRate * 100) / 100
          },
          recent: {
            byDay: byDay.map((item: any) => ({
              date: item._id.day,
              direction: item._id.direction,
              count: item.count
            })),
            byStatus: statusMap
          }
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Get advanced chat analytics
   */
  async getAdvancedChatAnalytics(req: AuthRequest, res: Response) {
    try {
      const workspaceId = new mongoose.Types.ObjectId(req.workspace._id);
      const days = clampDays(Number(req.query.days || 30));
      const { start, end, previousStart, previousEnd } = getPeriodBounds(days);

      const baseMatch = { workspace: workspaceId };
      const currentWindow = { createdAt: { $gte: start, $lte: end } };
      const previousWindow = { createdAt: { $gte: previousStart, $lt: previousEnd } };

      const [
        currentMessageCount,
        previousMessageCount,
        currentActiveContacts,
        previousActiveContacts,
        currentSpendAgg,
        previousSpendAgg,
        currentDeliveryAgg,
        previousDeliveryAgg,
        volumeByDayAgg,
        mixByCategoryAgg,
        agentAgg,
      ] = await Promise.all([
        Message.countDocuments({ ...baseMatch, ...currentWindow }),
        Message.countDocuments({ ...baseMatch, ...previousWindow }),
        Message.distinct("contact", { ...baseMatch, ...currentWindow, contact: { $exists: true, $ne: null } }),
        Message.distinct("contact", { ...baseMatch, ...previousWindow, contact: { $exists: true, $ne: null } }),
        Message.aggregate([
          {
            $match: {
              ...baseMatch,
              ...currentWindow,
              direction: "outbound",
              "conversationBilling.estimatedCost": { $gt: 0 },
            },
          },
          { $group: { _id: null, total: { $sum: "$conversationBilling.estimatedCost" } } },
        ]),
        Message.aggregate([
          {
            $match: {
              ...baseMatch,
              ...previousWindow,
              direction: "outbound",
              "conversationBilling.estimatedCost": { $gt: 0 },
            },
          },
          { $group: { _id: null, total: { $sum: "$conversationBilling.estimatedCost" } } },
        ]),
        Message.aggregate([
          { $match: { ...baseMatch, ...currentWindow, direction: "outbound" } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              delivered: {
                $sum: {
                  $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0],
                },
              },
            },
          },
        ]),
        Message.aggregate([
          { $match: { ...baseMatch, ...previousWindow, direction: "outbound" } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              delivered: {
                $sum: {
                  $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0],
                },
              },
            },
          },
        ]),
        Message.aggregate([
          { $match: { ...baseMatch, ...currentWindow } },
          {
            $group: {
              _id: {
                day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                direction: "$direction",
              },
              count: { $sum: 1 },
              delivered: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$direction", "outbound"] },
                        { $in: ["$status", ["delivered", "read"]] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { "_id.day": 1 } },
        ]),
        Message.aggregate([
          { $match: { ...baseMatch, ...currentWindow, direction: "outbound" } },
          {
            $group: {
              _id: "$conversationBilling.category",
              count: { $sum: 1 },
            },
          },
        ]),
        Conversation.aggregate([
          {
            $match: {
              workspace: workspaceId,
              assignedTo: { $exists: true, $ne: null },
              lastActivityAt: { $gte: start, $lte: end },
            },
          },
          {
            $group: {
              _id: "$assignedTo",
              handled: { $sum: 1 },
              resolved: {
                $sum: {
                  $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0],
                },
              },
              avgFirstResponseMs: {
                $avg: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$firstResponseAt", null] },
                        { $ne: ["$conversationStartedAt", null] },
                      ],
                    },
                    { $subtract: ["$firstResponseAt", "$conversationStartedAt"] },
                    null,
                  ],
                },
              },
            },
          },
          { $sort: { resolved: -1, handled: -1 } },
          { $limit: 8 },
        ]),
      ]);

      const currentSpend = Number(currentSpendAgg[0]?.total || 0);
      const previousSpend = Number(previousSpendAgg[0]?.total || 0);

      const currentTotalOutbound = Number(currentDeliveryAgg[0]?.total || 0);
      const currentDelivered = Number(currentDeliveryAgg[0]?.delivered || 0);
      const previousTotalOutbound = Number(previousDeliveryAgg[0]?.total || 0);
      const previousDelivered = Number(previousDeliveryAgg[0]?.delivered || 0);

      const currentDeliveryRate = currentTotalOutbound > 0 ? (currentDelivered / currentTotalOutbound) * 100 : 0;
      const previousDeliveryRate = previousTotalOutbound > 0 ? (previousDelivered / previousTotalOutbound) * 100 : 0;

      const dayMap = new Map<string, { sent: number; received: number; delivered: number }>();
      for (let i = days - 1; i >= 0; i -= 1) {
        const date = new Date(end);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().slice(0, 10);
        dayMap.set(key, { sent: 0, received: 0, delivered: 0 });
      }

      for (const row of volumeByDayAgg as Array<any>) {
        const day = row._id.day as string;
        const bucket = dayMap.get(day);
        if (!bucket) continue;
        if (row._id.direction === "outbound") {
          bucket.sent = row.count;
          bucket.delivered = row.delivered;
        } else {
          bucket.received = row.count;
        }
      }

      const messageVolume = Array.from(dayMap.entries()).map(([date, value]) => {
        const dateObj = new Date(`${date}T00:00:00.000Z`);
        return {
          date,
          name: dateObj.toLocaleDateString("en-US", { weekday: "short" }),
          sent: value.sent,
          received: value.received,
          delivered: value.delivered,
        };
      });

      const mixMap = new Map<string, number>();
      for (const item of mixByCategoryAgg as Array<any>) {
        if (!item._id) continue;
        mixMap.set(String(item._id), Number(item.count || 0));
      }

      const totalMix = Array.from(mixMap.values()).reduce((sum, n) => sum + n, 0);
      const conversationMix = CATEGORY_ORDER.map((category) => {
        const raw = mixMap.get(category.key) || 0;
        const value = totalMix > 0 ? Number(((raw / totalMix) * 100).toFixed(1)) : 0;
        return { name: category.name, value, color: category.color };
      });

      const topResolvedArr = (agentAgg as Array<any>).map((agent) => Number(agent.resolved || 0));
      const topResolved = topResolvedArr.length > 0 ? Math.max(1, ...topResolvedArr) : 1;
      const agentIds = (agentAgg as Array<any>).map((agent) => agent._id).filter(Boolean);
      const userDocs = agentIds.length
        ? await User.find({ _id: { $in: agentIds } }).select("name").lean()
        : [];
      const userNameMap = new Map(userDocs.map((user: any) => [String(user._id), user.name as string]));

      const agentPerformance = (agentAgg as Array<any>).map((agent, index) => {
        const resolved = Number(agent.resolved || 0);
        const handled = Number(agent.handled || 0);
        const avgMinutes = toMinutes(Number(agent.avgFirstResponseMs || 0));

        const outputScore = resolved / topResolved;
        const responseScore = avgMinutes > 0 ? Math.max(0, 1 - Math.min(avgMinutes, 30) / 30) : 0.5;
        const activityScore = Math.min(1, handled / 40);

        const satisfaction = Number((3.5 + outputScore * 0.9 + responseScore * 0.4 + activityScore * 0.2).toFixed(1));

        let status = "Consistent";
        if (index === 0 && resolved > 0) status = "Top Performer";
        else if (avgMinutes > 15 || resolved === 0) status = "Needs Attention";

        return {
          id: String(agent._id),
          name: userNameMap.get(String(agent._id)) || "Unassigned Agent",
          resolved,
          rTime: formatMinutesCompact(avgMinutes),
          satisfaction,
          status,
        };
      });

      res.json({
        success: true,
        data: {
          period: {
            days,
            startDate: start,
            endDate: end,
          },
          kpis: {
            totalMessages: currentMessageCount,
            totalMessagesChange: Number(pctChange(currentMessageCount, previousMessageCount).toFixed(1)),
            activeContacts: currentActiveContacts.length,
            activeContactsChange: Number(pctChange(currentActiveContacts.length, previousActiveContacts.length).toFixed(1)),
            estimatedSpend: Number(currentSpend.toFixed(2)),
            estimatedSpendChange: Number(pctChange(currentSpend, previousSpend).toFixed(1)),
            deliveryRate: Number(currentDeliveryRate.toFixed(1)),
            deliveryRateChange: Number(pctChange(currentDeliveryRate, previousDeliveryRate).toFixed(1)),
          },
          messageVolume,
          conversationMix,
          agentPerformance,
        },
      });
    } catch (err) {
      console.error("Error in getAdvancedChatAnalytics:", err);
      res.status(500).json({ success: false, error: "Failed to get analytics" });
    }
  },
  /**
   * Get message trends (daily volume)
   */
  async getMessageTrends(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = new mongoose.Types.ObjectId(req.workspace._id);
      const days = clampDays(Number(req.query.days || 30));
      const { start, end } = getPeriodBounds(days);

      const trends = await Message.aggregate([
        {
          $match: {
            workspace: workspaceId,
            createdAt: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              direction: "$direction"
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.day": 1 } }
      ]);

      res.json({ success: true, data: trends });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get template performance metrics
   */
  async getTemplatePerformance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = new mongoose.Types.ObjectId(req.workspace._id);

      const performance = await Message.aggregate([
        {
          $match: {
            workspace: workspaceId,
            type: 'template'
          }
        },
        {
          $group: {
            _id: "$body", // body stores template name for template messages
            totalSent: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0] } },
            read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } }
          }
        },
        { $sort: { totalSent: -1 } },
        { $limit: 20 }
      ]);

      res.json({ success: true, data: performance });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get agent performance metrics
   */
  async getAgentPerformance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = new mongoose.Types.ObjectId(req.workspace._id);
      const days = clampDays(Number(req.query.days || 30));
      const { start, end } = getPeriodBounds(days);

      const performance = await Conversation.aggregate([
        {
          $match: {
            workspace: workspaceId,
            assignedTo: { $exists: true, $ne: null },
            lastActivityAt: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: "$assignedTo",
            handled: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
            avgFirstResponseMs: {
              $avg: {
                $cond: [
                  { $and: [
                    { $gt: ["$firstResponseAt", null] },
                    { $gt: ["$conversationStartedAt", null] }
                  ]},
                  { $subtract: ["$firstResponseAt", "$conversationStartedAt"] },
                  null
                ]
              }
            }
          }
        }
      ]);

      // Populate user names
      const userIds = performance.map(p => p._id);
      const users = await User.find({ _id: { $in: userIds } }).select('name email avatar').lean();
      const userMap = new Map(users.map(u => [u._id.toString(), u]));

      const enrichedPerformance = performance.map(p => ({
        ...p,
        agent: userMap.get(p._id.toString()) || { name: 'Unknown' }
      }));

      res.json({ success: true, data: enrichedPerformance });
    } catch (err) {
      next(err);
    }
  }
};
