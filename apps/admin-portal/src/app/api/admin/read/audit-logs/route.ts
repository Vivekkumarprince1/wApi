import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * Audit trail — direct read (Rule #4). Returns general admin audit entries and,
 * on ?type=impersonation, the dedicated impersonation log.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin("read");

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "audit";
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const action = (searchParams.get("action") || "").trim();

    const { AuditLog, ImpersonationLog } = await coreModels();

    if (type === "impersonation") {
      const [items, total] = await Promise.all([
        ImpersonationLog.find({})
          .sort({ startedAt: -1 })
          .skip((page - 1) * PAGE_SIZE)
          .limit(PAGE_SIZE)
          .lean(),
        ImpersonationLog.countDocuments({}),
      ]);
      return NextResponse.json({ type, items, page, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
    }

    const filter: Record<string, unknown> = {};
    if (action) filter.action = { $regex: action, $options: "i" };

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return NextResponse.json({ type, items, page, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/audit-logs]", err);
    return NextResponse.json({ message: "Failed to load audit logs" }, { status: 500 });
  }
}
