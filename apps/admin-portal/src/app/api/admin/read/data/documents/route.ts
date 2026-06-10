import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Data Explorer — fetch documents (SELF-CONTAINED, direct from core DB).
 * Enforces the dangerous-operator guard and pagination caps locally. System role.
 *   ?collection=<name>&skip=&limit=&filter=<json>
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin("system");
    const { searchParams } = new URL(req.url);
    const collection = (searchParams.get("collection") || "").trim();
    if (!collection) {
      return NextResponse.json({ message: "collection is required" }, { status: 400 });
    }

    let filter: Record<string, unknown> = {};
    try {
      filter = JSON.parse(searchParams.get("filter") || "{}");
    } catch {
      return NextResponse.json({ message: "Invalid filter JSON" }, { status: 400 });
    }
    if (/\$where|\$function|\$accumulator|\$expr/.test(JSON.stringify(filter))) {
      return NextResponse.json(
        { message: "Filter contains prohibited operators ($where, $function, $accumulator, $expr)" },
        { status: 400 }
      );
    }

    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 100);
    const skip = Math.max(Number(searchParams.get("skip")) || 0, 0);

    const { Workspace } = await coreModels();
    const db = Workspace.db.db;
    if (!db) throw new Error("core DB unavailable");
    const coll = db.collection(collection);

    const [docs, total] = await Promise.all([
      coll.find(filter).sort({ _id: -1 }).skip(skip).limit(limit).toArray(),
      coll.countDocuments(filter),
    ]);

    return NextResponse.json({ success: true, data: docs, pagination: { total, limit, skip } });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/data/documents]", err);
    return NextResponse.json({ message: "Failed to fetch documents" }, { status: 500 });
  }
}
