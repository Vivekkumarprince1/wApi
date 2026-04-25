import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Campaign, Template, Contact, Message, Conversation } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import mongoose from "mongoose";

export const GET = withFeature('ANALYTICS', async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();
    const workspaceId = workspace._id;
    const ObjectId = mongoose.Types.ObjectId;

    // Time window (Last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // 1. Static Counts & Snapshots
    const [activeCampaigns, totalTemplates, totalContacts] = await Promise.all([
      Campaign.countDocuments({
        workspace: workspaceId,
        status: { $in: ['SCHEDULED', 'RUNNING', 'queued', 'sending'] }
      }),
      Template.countDocuments({
        workspace: workspaceId,
        status: { $ne: 'DELETED' }
      }),
      Contact.countDocuments({
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

    // 4. Mapping to Dashboard Expected Schema
    const deliveryRate = outbound.total > 0 ? (outbound.delivered / outbound.total) * 100 : 0;
    const readRate = outbound.delivered > 0 ? (outbound.read / outbound.delivered) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalContacts,
        messages: {
           totalOutbound: outbound.total,
           totalInbound: inbound.total,
           deliveryRate: Math.round(deliveryRate * 100) / 100,
           readRate: Math.round(readRate * 100) / 100
        },
        activeCampaigns,
        totalTemplates,
        conversations: {
          resolved
        },
        recentActivity: [] // Will implement activity logger in next iteration
      }
    });

  } catch (err: any) {
    console.error("[Dashboard Overview API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
