import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { billingModels, coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * Invoice ledger — direct read (Rule #4). Mirrors core-server's
 * adminController.listInvoices (which proxies billing-service
 * /admin/all-invoices) but reads the invoices collection directly.
 *
 * The monolith stores the workspace reference as `workspace`; the billing
 * service uses `workspaceId`. We resolve workspace names from whichever is set.
 * ?status= filter, ?page= pagination.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin("billing");

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const { Invoice } = await billingModels();
    const { Workspace } = await coreModels();

    const [items, total, totalsAgg] = await Promise.all([
      Invoice.find(filter)
        .sort({ issuedAt: -1, createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Invoice.countDocuments(filter),
      Invoice.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 }, totalCents: { $sum: "$totalCents" } } },
      ]),
    ]);

    // Resolve workspace names (best-effort) in one batched query.
    const wsIds = Array.from(
      new Set(
        (items as Array<Record<string, unknown>>)
          .map((i) => String(i.workspace ?? i.workspaceId ?? ""))
          .filter(Boolean)
      )
    );
    const workspaces = wsIds.length
      ? await Workspace.find({ _id: { $in: wsIds } }).select("name").lean()
      : [];
    const wsName = new Map(workspaces.map((w: any) => [String(w._id), (w as { name?: string }).name]));

    const enriched = (items as Array<Record<string, unknown>>).map((i) => ({
      ...i,
      workspaceName: wsName.get(String(i.workspace ?? i.workspaceId ?? "")) || "—",
    }));

    const summary: Record<string, { count: number; totalCents: number }> = {};
    for (const row of totalsAgg as Array<{ _id: string; count: number; totalCents: number }>) {
      summary[row._id || "unknown"] = { count: row.count, totalCents: row.totalCents || 0 };
    }

    return NextResponse.json({
      items: enriched,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      summary,
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/invoices]", err);
    return NextResponse.json({ message: "Failed to load invoices" }, { status: 500 });
  }
}
