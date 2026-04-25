/**
 * API: /api/tags
 * Tag management for contacts and conversations
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Tag, Contact } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET: List tags with usage counts
 */
export const GET = withAuth(async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "100");

    let query: any = { workspace: workspace._id };

    if (search) {
      query.normalizedName = { $regex: search.toLowerCase(), $options: "i" };
    }

    const tags = await Tag.find(query)
      .select('name color description scope usageCount')
      .sort({ name: 1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      tags,
      total: tags.length
    });
  } catch (err: any) {
    console.error("[Tags List API Error]:", err.message);
    return NextResponse.json({ 
      message: "Server Error",
      error: err.message
    }, { status: 500 });
  }
});
