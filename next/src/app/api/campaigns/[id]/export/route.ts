import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { CampaignMessage, Campaign } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET /api/campaigns/[id]/export
 * 
 * Generates a CSV report of all recipients in a campaign.
 */
export const GET = withAuth(async (req: NextRequest, { workspace, params }) => {
  try {
    await dbConnect();
    const id = params.id;

    // 1. Verify access
    const campaign = await Campaign.findOne({ _id: id, workspace: workspace._id });
    if (!campaign) return NextResponse.json({ message: "Campaign not found" }, { status: 404 });

    // 2. Fetch all messages
    const messages = await CampaignMessage.find({ 
        workspace: workspace._id, 
        campaign: id 
    })
    .populate('contact', 'name phone')
    .sort({ createdAt: 1 })
    .lean();

    // 3. Generate CSV content
    const headers = [
      "Contact Name",
      "Phone",
      "Status",
      "Sent At",
      "Delivered At",
      "Read At",
      "Error Reason"
    ];

    const rows = messages.map((m: any) => [
      `"${m.contact?.name || 'Unknown'}"`,
      m.phone || m.contact?.phone || '',
      m.status.toUpperCase(),
      m.sentAt ? new Date(m.sentAt).toLocaleString() : '',
      m.deliveredAt ? new Date(m.deliveredAt).toLocaleString() : '',
      m.readAt ? new Date(m.readAt).toLocaleString() : '',
      `"${m.failureReason || m.lastError || ''}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // 4. Return as downloadable file
    const filename = `campaign_report_${campaign.name.replace(/\s+/g, '_').toLowerCase()}.csv`;

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (err: any) {
    console.error(`[CampaignExportAPI] Error:`, err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
