/**
 * API: /api/templates
 * Port of legacy templateController.listTemplates & createTemplate
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Template } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET: List all workspace templates
 */
export const GET = withFeature('TEMPLATES_LIBRARY', async (req: NextRequest, { workspace }) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");

    await dbConnect();

    // Build query
    const query: any = { workspace: workspace._id };
    if (status) query.status = status;
    if (category) query.category = category;

    // console.log(`[Templates:List] Query:`, JSON.stringify(query), `Workspace ID:`, workspace._id);

    const [templates, total] = await Promise.all([
      Template.find(query)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit),
      Template.countDocuments(query)
    ]);

    // console.log(`[Templates:List] Result Count:`, templates.length, `Total in DB:`, total);


    return NextResponse.json({
      success: true,
      data: templates,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    console.error("[Templates List API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});

/**
 * POST: Create a new DRAFT template
 */
export const POST = withFeature('TEMPLATES_LIBRARY', async (req: NextRequest, { workspace, user }) => {
  try {
    const body = await req.json();
    const { name, category, language, header, body: templateBody, footer, buttons, templateType, lto, carousel } = body;

    if (!name || !templateBody?.text) {
      return NextResponse.json({ message: "Name and body text are required" }, { status: 400 });
    }

    await dbConnect();

    // Check for unique name in workspace
    const existing = await Template.findOne({ workspace: workspace._id, name: name.toLowerCase() });
    if (existing) {
      return NextResponse.json({ message: "Template name already exists in this workspace" }, { status: 409 });
    }

    const template = await Template.create({
      workspace: workspace._id,
      createdBy: user._id,
      name: name.toLowerCase(),
      category: category || 'MARKETING',
      language: language || 'en',
      templateType: templateType || 'STANDARD',
      header: header || { enabled: false, format: 'NONE' },
      body: templateBody,
      footer: footer || { enabled: false },
      buttons: buttons || { enabled: false, items: [] },
      lto: lto || { enabled: false, hasExpiration: false },
      carousel: carousel || { cards: [] },
      status: 'DRAFT'
    });

    return NextResponse.json({
      success: true,
      message: "Template created as DRAFT",
      data: template
    });
  } catch (err: any) {
    console.error("[Template Create API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
