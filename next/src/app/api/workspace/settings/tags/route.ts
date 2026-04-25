import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Tag } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withAuth(async (req, { workspace }) => {
  await dbConnect();
  const tags = await Tag.find({ workspace: workspace._id }).sort({ 'usageCount.total': -1, createdAt: -1 });
  return NextResponse.json({ success: true, data: tags });
});

export const POST = withAuth(async (req, { workspace, user }) => {
  await dbConnect();
  const { name, color } = await req.json();
  
  if (!name) {
    return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
  }

  const tag = await Tag.findOrCreate(workspace._id, name, user._id);
  if (color) {
    tag.color = color;
    await tag.save();
  }

  return NextResponse.json({ success: true, data: tag });
});
