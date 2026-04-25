import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { QuickReply } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const PATCH = withAuth(async (req: NextRequest, { workspace, params }) => {
  await dbConnect();
  const id = params?.id;
  const data = await req.json();

  const reply = await QuickReply.findOneAndUpdate(
    { _id: id, workspace: workspace._id },
    { $set: data },
    { returnDocument: 'after' }
  );

  if (!reply) {
    return NextResponse.json({ error: "Quick reply not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: reply });
});

export const DELETE = withAuth(async (req: NextRequest, { workspace, params }) => {
  await dbConnect();
  const id = params?.id;

  const reply = await QuickReply.findOneAndDelete({ _id: id, workspace: workspace._id });
  if (!reply) {
    return NextResponse.json({ error: "Quick reply not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: "Quick reply deleted" });
});
