import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db-connect";
import { withFeature } from "@/lib/middlewares/auth";
import { Message, Conversation, User } from "@/lib/models";

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

export const GET = withFeature("ANALYTICS", async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();

    const workspaceId = new mongoose.Types.ObjectId(workspace._id);
    const { searchParams } = new URL(req.url);
    const days = clampDays(Number(searchParams.get("days") || 30));
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

    const topResolved = Math.max(1, ...((agentAgg as Array<any>).map((agent) => Number(agent.resolved || 0))));
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

    return NextResponse.json({
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
  } catch (err: any) {
    console.error("[Advanced Chat Analytics API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
