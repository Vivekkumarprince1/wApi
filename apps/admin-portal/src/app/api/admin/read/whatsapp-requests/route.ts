import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/**
 * WhatsApp / BSP onboarding requests — direct read (Rule #4). Mirrors
 * core-server adminController.listWhatsAppRequests: every workspace that has
 * begun the embedded-signup (ESB) flow, newest first. ?status= filters on the
 * esbFlow.status. The schema is strict:false so esbFlow is read through.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin("operations");

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));

    const filter: Record<string, unknown> = { "esbFlow.status": { $ne: "not_started" } };
    if (status) filter["esbFlow.status"] = status;

    const { Workspace } = await coreModels();

    const [rows, total] = await Promise.all([
      Workspace.find(filter)
        .select("name owner esbFlow bspWabaId whatsappPhoneNumber onboardingStatus createdAt updatedAt")
        .populate("owner", "name email")
        .sort({ "esbFlow.startedAt": -1, updatedAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Workspace.countDocuments(filter),
    ]);

    const items = (rows as Array<Record<string, unknown>>).map((w) => {
      const esb = (w.esbFlow || {}) as Record<string, unknown>;
      return {
        _id: w._id,
        workspaceName: w.name,
        owner: w.owner,
        businessId: w.bspWabaId || "Pending",
        phoneNumber: w.whatsappPhoneNumber || "Pending",
        status: esb.status,
        onboardingStatus: w.onboardingStatus,
        accountBlocked: esb.accountBlocked || false,
        startedAt: esb.startedAt || w.createdAt,
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
