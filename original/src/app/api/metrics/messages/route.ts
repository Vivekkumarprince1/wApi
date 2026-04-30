import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Message, Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import mongoose from "mongoose";

const COUNTRY_CODES = [
  { code: '91', country: 'IN' },
  { code: '1', country: 'US/CA' },
  { code: '44', country: 'UK' },
  { code: '971', country: 'UAE' },
  { code: '60', country: 'MY' },
  { code: '65', country: 'SG' },
  { code: '62', country: 'ID' },
  { code: '55', country: 'BR' },
  { code: '52', country: 'MX' }
].sort((left, right) => right.code.length - left.code.length);

function detectCountryFromPhone(phone: string) {
  const normalized = String(phone || '').replace(/\D/g, '');
  if (!normalized) return 'Unknown';
  const match = COUNTRY_CODES.find((entry) => normalized.startsWith(entry.code));
  return match ? match.country : 'Other';
}

export const GET = withAuth(async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();
    const workspaceId = workspace._id;
    const ObjectId = mongoose.Types.ObjectId;

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "7", 10);
    
    const since = new Date();
    since.setDate(since.getDate() - days);

    // 1. Aggregations (Last N Days)
    const [byDay, byStatus, recentOutbound] = await Promise.all([
      // By Day & Direction
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
      // By Status
      Message.aggregate([
        { $match: { workspace: new ObjectId(workspaceId), createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      // Delivery Health Data
      Message.find({
        workspace: workspaceId,
        direction: 'outbound',
        createdAt: { $gte: since }
      }).select('recipientPhone status failureReason').lean()
    ]);

    // 2. Compute Delivery Health
    const statusMap: any = byStatus.reduce((acc: any, s: any) => {
      acc[s._id] = s.count;
      return acc;
    }, {});

    const accepted = (statusMap.queued || 0) + (statusMap.sent || 0) + (statusMap.delivered || 0) + (statusMap.read || 0);
    const confirmedDelivered = (statusMap.delivered || 0) + (statusMap.read || 0);
    const deliveryRate = accepted > 0 ? (confirmedDelivered / accepted) * 100 : 0;
    const failureRate = accepted > 0 ? ((statusMap.failed || 0) / accepted) * 100 : 0;

    const byCountry = recentOutbound.reduce((acc: any, item: any) => {
      const country = detectCountryFromPhone(item.recipientPhone);
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});

    const topFailures = Object.entries(
      recentOutbound
        .filter((item: any) => item.status === 'failed' && item.failureReason)
        .reduce((acc: any, item: any) => {
          acc[item.failureReason] = (acc[item.failureReason] || 0) + 1;
          return acc;
        }, {})
    )
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

    // 3. Provider Checks
    const providerChecks = {
      bspManaged: workspace.bspManaged,
      whatsappConnected: workspace.bspPhoneStatus === 'CONNECTED',
      businessVerified: ['VERIFIED', 'APPROVED', 'LIVE'].includes(String(workspace.bspPhoneStatus || '').toUpperCase()),
      webhookConfigured: true // Static for now, will dynamic check env later
    };

    return NextResponse.json({
      success: true,
      data: {
        deliveryHealth: {
          accepted,
          confirmedDelivered,
          deliveryRate: Math.round(deliveryRate * 100) / 100,
          failureRate: Math.round(failureRate * 100) / 100,
          byCountry,
          topFailures
        },
        providerChecks,
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
    console.error("[Message Metrics API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
