import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import mongoose from "mongoose";
import { CampaignMessage, Contact } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET /api/campaigns/[id]/messages
 * 
 * Fetches paginated recipient logs for a specific campaign.
 * Supports filtering by status and searching by phone/name.
 */
export const GET = withAuth(async (req: NextRequest, { workspace, params }) => {
  try {
    await dbConnect();
    const id = params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid campaign id" }, { status: 400 });
    }
    
    // Parse query params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const query: any = { 
        workspace: workspace._id, 
        campaign: new mongoose.Types.ObjectId(id)
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      const normalizedSearch = search.trim();
      const searchRegex = { $regex: normalizedSearch, $options: 'i' };
      const matchingContacts = await Contact.find({
        workspace: workspace._id,
        name: searchRegex
      }).select('_id').lean();

      query.$or = [
        { phone: searchRegex },
        ...(matchingContacts.length > 0 ? [{ contact: { $in: matchingContacts.map((contact) => contact._id) } }] : [])
      ];
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      CampaignMessage.find(query)
        .populate('contact', 'name phone email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CampaignMessage.countDocuments(query)
    ]);

    return NextResponse.json({
      success: true,
      messages,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (err: any) {
    console.error(`[CampaignMessagesAPI] Error:`, err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
