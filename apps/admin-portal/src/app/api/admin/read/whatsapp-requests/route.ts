import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { getConnection } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/**
 * WhatsApp / BSP onboarding requests — direct read from BSP-owned workspace
 * projections in `wapi_bsp`, newest first.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin("operations");

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));

    const filter: Record<string, unknown> = { "esbFlow.status": { $ne: "not_started" } };
    if (status) filter["esbFlow.status"] = status;

    const conn = await getConnection("bsp");
    const db = conn.db;
    if (!db) throw new Error("BSP database handle unavailable");
    const workspaces = db.collection("workspaces");

    const [rows, total] = await Promise.all([
      workspaces.find(filter)
        .project({ name: 1, owner: 1, esbFlow: 1, bspWabaId: 1, whatsappPhoneNumber: 1, onboardingStatus: 1, createdAt: 1, updatedAt: 1 })
        .sort({ "esbFlow.startedAt": -1, updatedAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .toArray(),
      workspaces.countDocuments(filter),
    ]);

    const items = rows.map((w) => {
      const record = w as Record<string, unknown>;
      const esb = (record.esbFlow || {}) as Record<string, unknown>;
      return {
        _id: record._id,
        workspaceName: record.name,
        owner: record.owner,
        businessId: record.bspWabaId || "Pending",
        phoneNumber: record.whatsappPhoneNumber || "Pending",
        status: esb.status,
        onboardingStatus: record.onboardingStatus,
        accountBlocked: esb.accountBlocked || false,
        startedAt: esb.startedAt || record.createdAt,
        completedAt: esb.completedAt || null,
        failureReason: esb.failureReason || esb.accountBlockedReason || null,
      };
    });

    return NextResponse.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/whatsapp-requests]", err);
    return NextResponse.json({ message: "Failed to load WhatsApp requests" }, { status: 500 });
  }
}
