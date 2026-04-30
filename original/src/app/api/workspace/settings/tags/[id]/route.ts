import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Tag } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const DELETE = withAuth(async (req: NextRequest, { workspace, params }) => {
  await dbConnect();
  const id = params?.id;
  
  const tag = await Tag.findOne({ _id: id, workspace: workspace._id });
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  await Tag.deleteOne({ _id: tag._id });

  return NextResponse.json({ success: true, message: "Tag deleted" });
});
