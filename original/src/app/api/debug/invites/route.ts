import { NextResponse } from "next/server";
import { WorkspaceInvitation } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export async function GET() {
  try {
    await dbConnect();
    const all = await WorkspaceInvitation.find({}).populate('workspace', 'name').lean();
    return NextResponse.json(all);
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
