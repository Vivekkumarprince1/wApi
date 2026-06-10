import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

/**
 * Workspace directory — direct MongoDB read (Rule #4). Returns the full field
 * set the super-admin workspace console needs (connection health, BSP/Gupshup
 * identity, wallet, onboarding) so the client can render summary cards, the
 * detail panel, and filter/search locally (schema is strict:false).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin("workspaces");

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const status = (searchParams.get("status") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));

    const filter: Record<string, unknown> = {};
    if (q) filter.name = { $regex: q, $options: "i" };
    if (status) filter.billingStatus = status;

    const { Workspace } = await coreModels();

    const [items, total] = await Promise.all([
      Workspace.find(filter)
        .select(
          "name owner plan billingStatus billingCycle whatsappConnected wallet walletBalance " +
            "walletCurrency walletParkedBalance walletThreshold gupshupAppId gupshupIdentity " +
            "gupshupAppLive gupshupAppHealth bspWabaId wabaId bspPhoneStatus bspSyncStatus " +
            "bspLastSyncedAt esbFlow phoneNumbers onboardingStatus isVerified createdAt"
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("owner", "name email")
        .populate("plan", "name slug")
        .lean(),
      Workspace.countDocuments(filter),
    ]);

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
    console.error("[admin/read/workspaces]", err);
    return NextResponse.json({ message: "Failed to load workspaces" }, { status: 500 });
  }
}
