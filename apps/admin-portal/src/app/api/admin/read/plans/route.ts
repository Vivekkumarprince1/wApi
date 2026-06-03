import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Plan catalogue — direct read (Rule #4). */
export async function GET() {
  try {
    await requireAdmin("read");
    const { Plan } = await coreModels();
    const items = await Plan.find({}).sort({ name: 1 }).lean();
    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/plans]", err);
    return NextResponse.json({ message: "Failed to load plans" }, { status: 500 });
  }
}
