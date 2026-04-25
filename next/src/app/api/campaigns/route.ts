/**
 * API: /api/campaigns
 * Fetches broadcast campaigns for the authenticated workspace.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Campaign } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withFeature('CAMPAIGNS', async (req: NextRequest, { user, workspace }) => {
  try {
    await dbConnect();

    const workspaceId = workspace._id;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const type = searchParams.get("type"); // one-time, scheduled, api
    const status = searchParams.get("status");

    // Build query
    const query: any = { workspace: workspaceId };
    
    if (type && type !== 'all') {
      if (type === 'one-time') {
        query.campaignType = { $in: ['one-time', null] };
      } else {
        query.campaignType = type;
      }
    }

    if (status) {
      query.status = status;
    }

    const [campaigns, total, statsResult] = await Promise.all([
      Campaign.find(query)
        .populate('template', 'name category')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Campaign.countDocuments(query),
      Campaign.aggregate([
        { $match: { workspace: workspaceId } },
        {
          $group: {
            _id: null,
            totalSent: { $sum: '$sentCount' },
            totalDelivered: { $sum: '$deliveredCount' },
            totalRead: { $sum: '$readCount' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const stats = statsResult[0] || { totalSent: 0, totalDelivered: 0, totalRead: 0, count: 0 };
    const avgDelivery = stats.totalSent > 0 ? (stats.totalDelivered / stats.totalSent) * 100 : 0;
    const avgOpenRate = stats.totalSent > 0 ? (stats.totalRead / stats.totalSent) * 100 : 0;

    return NextResponse.json({
      success: true,
      campaigns,
      stats: {
        avgDelivery: parseFloat(avgDelivery.toFixed(1)),
        avgOpenRate: parseFloat(avgOpenRate.toFixed(1)),
        totalSent: stats.totalSent,
        totalCampaigns: stats.count
      },
      pagination: {
        total,
        page,
        limit,
        hasMore: page * limit < total
      }
    });

  } catch (err: any) {
    console.error("[Campaigns API Error]:", err.message);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch campaigns", 
      error: err.message 
    }, { status: 500 });
  }
});
