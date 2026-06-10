import express from 'express';
import mongoose from 'mongoose';
import { SupportTicket, Macro, Message, Conversation, User } from '../models/index.js';

// ─── Analytics helpers ────────────────────────────────────────────────────────

const CATEGORY_ORDER = [
  { key: 'marketing_conversation', name: 'Marketing', color: '#10b981' },
  { key: 'utility_conversation', name: 'Utility', color: '#3b82f6' },
  { key: 'service_conversation', name: 'Service', color: '#6366f1' },
  { key: 'authentication_conversation', name: 'Auth', color: '#f59e0b' },
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

function toMinutes(ms: number) { return Math.max(0, ms / 60000); }

function formatMinutesCompact(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '-';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Support Tickets ──────────────────────────────────────────────────────────

export const getTickets = async (req: any, res: express.Response) => {
  try {
    const tickets = await SupportTicket.find({ workspace: req.workspace?._id })
      .populate('assignedTo', 'name email')
      .populate('contact', 'name phone')
      .sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, data: tickets });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createTicket = async (req: any, res: express.Response) => {
  try {
    const ticket = await SupportTicket.create({
      ...req.body,
      workspace: req.workspace?._id,
      createdBy: req.user?._id
    });
    return res.status(201).json({ success: true, data: ticket });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTicket = async (req: any, res: express.Response) => {
  try {
    const ticket = await SupportTicket.findOneAndUpdate(
      { _id: req.params.id, workspace: req.workspace?._id },
      { $set: req.body },
      { new: true }
    );
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    return res.status(200).json({ success: true, data: ticket });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Macros ───────────────────────────────────────────────────────────────────

export const getMacros = async (req: any, res: express.Response) => {
  try {
    const macros = await Macro.find({
      workspace: req.workspace?._id,
      $or: [{ isActive: true }, { isActive: { $exists: false } }]
    });
    return res.status(200).json({ success: true, data: macros });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createMacro = async (req: any, res: express.Response) => {
  try {
    const { name, content, shortcut, isActive } = req.body || {};
    const macro = await Macro.create({
      name, content,
      shortcut: shortcut || '',
      isActive: isActive !== false,
      workspace: req.workspace?._id,
      createdBy: req.user?._id
    });
    return res.status(201).json({ success: true, data: macro });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMacro = async (req: any, res: express.Response) => {
  try {
    const { name, content, shortcut, isActive } = req.body || {};
    const macro = await Macro.findOneAndUpdate(
      { _id: req.params.id, workspace: req.workspace?._id },
      { $set: { name, content, shortcut: shortcut || '', isActive: isActive !== false } },
      { new: true }
    );
    if (!macro) {
      return res.status(404).json({ success: false, message: 'Macro not found' });
    }
    return res.status(200).json({ success: true, data: macro });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMacro = async (req: any, res: express.Response) => {
  try {
    const macro = await Macro.findOneAndDelete({ _id: req.params.id, workspace: req.workspace?._id });
    if (!macro) {
      return res.status(404).json({ success: false, message: 'Macro not found' });
    }
    return res.status(200).json({ success: true, message: 'Macro deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Analytics & Dashboard ────────────────────────────────────────────────────

export const getDashboardOverview = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    if (!workspaceId) return res.status(400).json({ success: false, message: 'Workspace context missing' });

    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ success: false, message: 'Database connection not initialized' });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const [
      totalTemplates,
      totalContacts,
      openTickets,
      totalMacros,
      resolvedConversationsCount,
      messageStats,
    ] = await Promise.all([
      db.collection('templates').countDocuments({ workspace: workspaceId, status: { $ne: 'DELETED' } }).catch(() => 0),
      db.collection('contacts').countDocuments({ workspace: workspaceId }).catch(() => 0),
      SupportTicket.countDocuments({ workspace: workspaceId, status: { $in: ['open', 'pending'] } }).catch(() => 0),
      Macro.countDocuments({ workspace: workspaceId }).catch(() => 0),
      Conversation.countDocuments({ workspace: workspaceId, status: 'resolved' }).catch(() => 0),
      Message.aggregate([
        { $match: { workspace: workspaceId, createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$direction',
            total: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            read: { $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] } },
          },
        },
      ]).catch(() => []),
    ]);

    const outbound = (messageStats as any[]).find((s) => s._id === 'outbound') || { total: 0, delivered: 0, read: 0 };
    const inbound = (messageStats as any[]).find((s) => s._id === 'inbound') || { total: 0 };

    const deliveryRate = outbound.total > 0 ? (outbound.delivered / outbound.total) * 100 : 0;
    const readRate = outbound.delivered > 0 ? (outbound.read / outbound.delivered) * 100 : 0;

    // Recent activity from activitylogs collection (written by audit consumer)
    const recentLogs = await db.collection('auditlogs').find({}).sort({ createdAt: -1 }).limit(10).toArray().catch(() => []);
    const recentActivity = recentLogs.map((log: any) => ({
      id: log._id,
      title: `${log.action} on ${log.resource?.type || 'system'}`,
      type: log.resource?.type?.toLowerCase() || 'system',
      action: log.action,
      time: log.createdAt,
      status: 'success',
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalContacts,
        messages: {
          totalOutbound: outbound.total,
          totalInbound: inbound.total,
          deliveryRate: Math.round(deliveryRate * 100) / 100,
          readRate: Math.round(readRate * 100) / 100,
        },
        activeCampaigns: 0,
        totalTemplates,
        activeAds: 0,
        automation: { workflows: 0, autoReplies: 0, aiIntents: 0, answerBotEnabled: false },
        support: { openTickets, totalMacros },
        conversations: { resolved: resolvedConversationsCount },
        campaigns: {
          replyRate: Math.round((outbound.total > 0 ? (inbound.total / outbound.total) : 0) * 100) / 100,
        },
        recentActivity,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdvancedChatAnalytics = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    if (!workspaceId) return res.status(400).json({ success: false, message: 'Workspace context missing' });

    const days = clampDays(Number(req.query.days || 30));
    const { start, end, previousStart, previousEnd } = getPeriodBounds(days);
    const wid = new mongoose.Types.ObjectId(workspaceId);
    const baseMatch = { workspace: wid };
    const currentWindow = { createdAt: { $gte: start, $lte: end } };
    const previousWindow = { createdAt: { $gte: previousStart, $lt: previousEnd } };

    const [
      currentMessageCount, previousMessageCount,
      currentActiveContacts, previousActiveContacts,
      currentSpendAgg, previousSpendAgg,
      currentDeliveryAgg, previousDeliveryAgg,
      volumeByDayAgg, mixByCategoryAgg, agentAgg,
    ] = await Promise.all([
      Message.countDocuments({ ...baseMatch, ...currentWindow }),
      Message.countDocuments({ ...baseMatch, ...previousWindow }),
      Message.distinct('contact', { ...baseMatch, ...currentWindow, contact: { $exists: true, $ne: null } }),
      Message.distinct('contact', { ...baseMatch, ...previousWindow, contact: { $exists: true, $ne: null } }),
      Message.aggregate([
        { $match: { ...baseMatch, ...currentWindow, direction: 'outbound', 'conversationBilling.estimatedCost': { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$conversationBilling.estimatedCost' } } },
      ]),
      Message.aggregate([
        { $match: { ...baseMatch, ...previousWindow, direction: 'outbound', 'conversationBilling.estimatedCost': { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$conversationBilling.estimatedCost' } } },
      ]),
      Message.aggregate([
        { $match: { ...baseMatch, ...currentWindow, direction: 'outbound' } },
        { $group: { _id: null, total: { $sum: 1 }, delivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0] } } } },
      ]),
      Message.aggregate([
        { $match: { ...baseMatch, ...previousWindow, direction: 'outbound' } },
        { $group: { _id: null, total: { $sum: 1 }, delivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0] } } } },
      ]),
      Message.aggregate([
        { $match: { ...baseMatch, ...currentWindow } },
        {
          $group: {
            _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, direction: '$direction' },
            count: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $and: [{ $eq: ['$direction', 'outbound'] }, { $in: ['$status', ['delivered', 'read']] }] }, 1, 0] } },
          },
        },
        { $sort: { '_id.day': 1 } },
      ]),
      Message.aggregate([
        { $match: { ...baseMatch, ...currentWindow, direction: 'outbound' } },
        { $group: { _id: '$conversationBilling.category', count: { $sum: 1 } } },
      ]),
      Conversation.aggregate([
        { $match: { workspace: wid, assignedTo: { $exists: true, $ne: null }, lastActivityAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: '$assignedTo',
            handled: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } },
            avgFirstResponseMs: {
              $avg: {
                $cond: [
                  { $and: [{ $ne: ['$firstResponseAt', null] }, { $ne: ['$conversationStartedAt', null] }] },
                  { $subtract: ['$firstResponseAt', '$conversationStartedAt'] },
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

    const currentSpend = Number((currentSpendAgg as any[])[0]?.total || 0);
    const previousSpend = Number((previousSpendAgg as any[])[0]?.total || 0);
    const currentTotalOutbound = Number((currentDeliveryAgg as any[])[0]?.total || 0);
    const currentDelivered = Number((currentDeliveryAgg as any[])[0]?.delivered || 0);
    const previousTotalOutbound = Number((previousDeliveryAgg as any[])[0]?.total || 0);
    const previousDelivered = Number((previousDeliveryAgg as any[])[0]?.delivered || 0);
    const currentDeliveryRate = currentTotalOutbound > 0 ? (currentDelivered / currentTotalOutbound) * 100 : 0;
    const previousDeliveryRate = previousTotalOutbound > 0 ? (previousDelivered / previousTotalOutbound) * 100 : 0;

    // Build day-by-day volume map
    const dayMap = new Map<string, { sent: number; received: number; delivered: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      dayMap.set(d.toISOString().slice(0, 10), { sent: 0, received: 0, delivered: 0 });
    }
    for (const row of volumeByDayAgg as any[]) {
      const bucket = dayMap.get(row._id.day);
      if (!bucket) continue;
      if (row._id.direction === 'outbound') { bucket.sent = row.count; bucket.delivered = row.delivered; }
      else { bucket.received = row.count; }
    }
    const messageVolume = Array.from(dayMap.entries()).map(([date, val]) => ({
      date,
      name: new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', { weekday: 'short' }),
      sent: val.sent, received: val.received, delivered: val.delivered,
    }));

    const mixMap = new Map<string, number>();
    for (const item of mixByCategoryAgg as any[]) {
      if (item._id) mixMap.set(String(item._id), Number(item.count || 0));
    }
    const totalMix = Array.from(mixMap.values()).reduce((s, n) => s + n, 0);
    const conversationMix = CATEGORY_ORDER.map((cat) => {
      const raw = mixMap.get(cat.key) || 0;
      return { name: cat.name, value: totalMix > 0 ? Number(((raw / totalMix) * 100).toFixed(1)) : 0, color: cat.color };
    });

    const topResolvedArr = (agentAgg as any[]).map((a) => Number(a.resolved || 0));
    const topResolved = topResolvedArr.length > 0 ? Math.max(1, ...topResolvedArr) : 1;
    const agentIds = (agentAgg as any[]).map((a) => a._id).filter(Boolean);
    const userDocs = agentIds.length ? await User.find({ _id: { $in: agentIds } }).select('name').lean() : [];
    const userNameMap = new Map((userDocs as any[]).map((u) => [String(u._id), u.name as string]));

    const agentPerformance = (agentAgg as any[]).map((agent, i) => {
      const resolved = Number(agent.resolved || 0);
      const handled = Number(agent.handled || 0);
      const avgMins = toMinutes(Number(agent.avgFirstResponseMs || 0));
      const outputScore = resolved / topResolved;
      const responseScore = avgMins > 0 ? Math.max(0, 1 - Math.min(avgMins, 30) / 30) : 0.5;
      const activityScore = Math.min(1, handled / 40);
      const satisfaction = Number((3.5 + outputScore * 0.9 + responseScore * 0.4 + activityScore * 0.2).toFixed(1));
      let status = 'Consistent';
      if (i === 0 && resolved > 0) status = 'Top Performer';
      else if (avgMins > 15 || resolved === 0) status = 'Needs Attention';
      return { id: String(agent._id), name: userNameMap.get(String(agent._id)) || 'Unassigned Agent', resolved, rTime: formatMinutesCompact(avgMins), satisfaction, status };
    });

    return res.status(200).json({
      success: true,
      data: {
        period: { days, startDate: start, endDate: end },
        kpis: {
          totalMessages: currentMessageCount,
          totalMessagesChange: Number(pctChange(currentMessageCount, previousMessageCount).toFixed(1)),
          activeContacts: (currentActiveContacts as any[]).length,
          activeContactsChange: Number(pctChange((currentActiveContacts as any[]).length, (previousActiveContacts as any[]).length).toFixed(1)),
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getMessageTrends = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    if (!workspaceId) return res.status(400).json({ success: false, message: 'Workspace context missing' });

    const days = clampDays(Number(req.query.days || 30));
    const { start, end } = getPeriodBounds(days);

    const trends = await Message.aggregate([
      { $match: { workspace: new mongoose.Types.ObjectId(workspaceId), createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, direction: '$direction' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.day': 1 } },
    ]);

    return res.status(200).json({ success: true, data: trends });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTemplatePerformance = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    if (!workspaceId) return res.status(400).json({ success: false, message: 'Workspace context missing' });

    const performance = await Message.aggregate([
      { $match: { workspace: new mongoose.Types.ObjectId(workspaceId), type: 'template' } },
      {
        $group: {
          _id: '$body',
          totalSent: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
      { $sort: { totalSent: -1 } },
      { $limit: 20 },
    ]);

    return res.status(200).json({ success: true, data: performance });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAgentPerformance = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    if (!workspaceId) return res.status(400).json({ success: false, message: 'Workspace context missing' });

    const days = clampDays(Number(req.query.days || 30));
    const { start, end } = getPeriodBounds(days);
    const wid = new mongoose.Types.ObjectId(workspaceId);

    const performance = await Conversation.aggregate([
      {
        $match: {
          workspace: wid,
          assignedTo: { $exists: true, $ne: null },
          lastActivityAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          handled: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          avgFirstResponseMs: {
            $avg: {
              $cond: [
                { $and: [{ $gt: ['$firstResponseAt', null] }, { $gt: ['$conversationStartedAt', null] }] },
                { $subtract: ['$firstResponseAt', '$conversationStartedAt'] },
                null,
              ],
            },
          },
        },
      },
    ]);

    const userIds = (performance as any[]).map((p) => p._id);
    const users = await User.find({ _id: { $in: userIds } }).select('name email avatar').lean();
    const userMap = new Map((users as any[]).map((u) => [u._id.toString(), u]));

    const enriched = (performance as any[]).map((p) => ({
      ...p,
      agent: userMap.get(p._id.toString()) || { name: 'Unknown' },
    }));

    return res.status(200).json({ success: true, data: enriched });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getGeneralMetrics = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    if (!workspaceId) return res.status(400).json({ success: false, message: 'Workspace context missing' });

    const wid = new mongoose.Types.ObjectId(workspaceId);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalMessages, totalConversations, openConversations, avgResponseAgg] = await Promise.all([
      Message.countDocuments({ workspace: wid, createdAt: { $gte: thirtyDaysAgo } }),
      Conversation.countDocuments({ workspace: wid }),
      Conversation.countDocuments({ workspace: wid, status: 'open' }),
      Conversation.aggregate([
        { $match: { workspace: wid, firstResponseAt: { $exists: true }, conversationStartedAt: { $exists: true } } },
        { $group: { _id: null, avgMs: { $avg: { $subtract: ['$firstResponseAt', '$conversationStartedAt'] } } } },
      ]),
    ]);

    const avgResponseMs = (avgResponseAgg as any[])[0]?.avgMs || 0;

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalMessages,
          totalConversations,
          openConversations,
          avgFirstResponseTime: formatMinutesCompact(toMinutes(avgResponseMs)),
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Outbound message delivery health for the dashboard (GET /metrics/messages?days=7).
 */
export const getMessageMetrics = async (req: any, res: express.Response) => {
  try {
    const workspaceId = req.workspace?._id;
    if (!workspaceId) return res.status(400).json({ success: false, message: 'Workspace context missing' });

    const wid = new mongoose.Types.ObjectId(workspaceId);
    const days = clampDays(parseInt(req.query.days, 10) || 7);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const byStatus = await Message.aggregate([
      { $match: { workspace: wid, direction: 'outbound', createdAt: { $gte: since } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const statusMap: Record<string, number> = byStatus.reduce((acc: any, s: any) => {
      acc[s._id] = s.count;
      return acc;
    }, {});

    const accepted =
      (statusMap.queued || 0) + (statusMap.sending || 0) + (statusMap.sent || 0) +
      (statusMap.delivered || 0) + (statusMap.read || 0);
    const confirmedDelivered = (statusMap.delivered || 0) + (statusMap.read || 0);
    const deliveryRate = accepted > 0 ? (confirmedDelivered / accepted) * 100 : 0;
    const failureRate = accepted > 0 ? ((statusMap.failed || 0) / accepted) * 100 : 0;

    return res.status(200).json({
      success: true,
      data: {
        deliveryHealth: {
          accepted,
          confirmedDelivered,
          deliveryRate: Math.round(deliveryRate * 100) / 100,
          failureRate: Math.round(failureRate * 100) / 100,
        },
        recent: { byStatus: statusMap },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
