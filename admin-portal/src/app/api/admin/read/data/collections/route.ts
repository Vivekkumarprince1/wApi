import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Data Explorer — list collections (SELF-CONTAINED, direct from core DB). System role. */
export async function GET() {
  try {
    await requireAdmin("system");
    const { Workspace } = await coreModels();
    const db = Workspace.db.db;
    if (!db) throw new Error("core DB unavailable");
    const collections = await db.listCollections().toArray();
    return NextResponse.json({ success: true, data: collections.map((c: any) => c.name).sort() });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/data/collections]", err);
    return NextResponse.json({ message: "Failed to list collections" }, { status: 500 });
  }
}
