/**
 * API: /api/templates/categories
 * Port of legacy templateController.getTemplateCategories
 * Returns unique categories used in the workspace's templates.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Template } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withAuth(async (req: NextRequest, { user, workspace }) => {
  try {
    await dbConnect();

    // 1. Aggregate unique categories for this workspace
    // Also include valid default Meta categories
    const categoriesAgg = await Template.aggregate([
      { 
        $match: { 
          workspace: workspace._id,
          status: { $ne: 'DELETED' }
        } 
      },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const activeCategories = categoriesAgg.map(item => item._id);
    const defaults = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
    
    // Combine and unique
    const uniqueCategories = Array.from(new Set([...defaults, ...activeCategories]));

    return NextResponse.json({
      success: true,
      categories: uniqueCategories,
      activeCounts: categoriesAgg.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });

  } catch (err: any) {
    console.error("[Template Categories API Error]:", err.message);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch categories", 
      error: err.message 
    }, { status: 500 });
  }
});
