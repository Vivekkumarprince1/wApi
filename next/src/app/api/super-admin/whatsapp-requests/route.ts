/**
 * API: /api/super-admin/whatsapp-requests
 * Fetches WABA provisioning and Embedded Signup requests across all workspaces.
 */

import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withRole(['super_admin'], async (req: NextRequest, { user }) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status");

    // Build query for workspaces that have initiated or completed setup
    const query: any = {
      'esbFlow.status': { $ne: 'not_started' }
    };

    if (status) {
      query['esbFlow.status'] = status;
    }

    const [requests, total] = await Promise.all([
      Workspace.find(query)
        .populate('owner', 'name email')
        .sort({ 'esbFlow.startedAt': -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Workspace.countDocuments(query)
    ]);

    // Format for administrative view
    const formattedRequests = requests.map(workspace => ({
      _id: workspace._id,
      workspaceName: workspace.name,
      owner: workspace.owner,
      businessId: workspace.bspWabaId || 'Pending',
      phoneNumber: workspace.whatsappPhoneNumber || 'Pending',
      status: workspace.esbFlow.status,
      startedAt: workspace.esbFlow.startedAt || workspace.createdAt,
      completedAt: workspace.esbFlow.completedAt,
      failureReason: workspace.esbFlow.failureReason
    }));

    // Aggregate stats
    const stats = await Workspace.aggregate([
      { $match: { 'esbFlow.status': { $ne: 'not_started' } } },
      {
        $group: {
          _id: '$esbFlow.status',
          count: { $sum: 1 }
        }
      }
    ]);

    return NextResponse.json({
      success: true,
      data: formattedRequests,
      stats: stats.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, { total }),
      pagination: {
        total,
        page,
        limit,
        hasMore: page * limit < total
      }
    });

  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch WABA requests", 
      error: err.message 
    }, { status: 500 });
  }
}) as any;
