import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { getConnection } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook subscription status for a workspace. The authoritative mirror lives
 * in `wapi_bsp.bsp_subscriptions`, read directly by the admin control plane.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin("operations");

    const { searchParams } = new URL(req.url);
    const workspaceId = (searchParams.get("workspaceId") || "").trim();
    if (!workspaceId) {
      return NextResponse.json({ message: "workspaceId is required" }, { status: 400 });
    }

    const conn = await getConnection("bsp");
    const db = conn.db;
    if (!db) throw new Error("BSP database handle unavailable");

    const subscriptions = await db.collection("bsp_subscriptions")
      .find({ workspaceId, status: { $ne: "deleted" } })
      .sort({ updatedAt: -1 })
      .toArray();

    const lastSyncedAt = subscriptions.reduce<Date | null>((latest, subscription) => {
      const providerData = subscription.providerData as Record<string, unknown> | undefined;
      const candidate = providerData?.syncedAt || subscription.updatedAt;
      const date = candidate ? new Date(String(candidate)) : null;
      if (!date || Number.isNaN(date.getTime())) return latest;
      return !latest || date > latest ? date : latest;
    }, null);

    return NextResponse.json({
      workspaceId,
      subscriptions: subscriptions.map((subscription) => {
        const providerData = subscription.providerData as Record<string, unknown> | undefined;
        return {
          id: String(subscription._id),
          providerSubscriptionId: providerData?.providerSubscriptionId,
          url: subscription.callbackUrl,
          modes: subscription.events || [],
          events: subscription.events || [],
          status: subscription.status || "unknown",
          syncedAt: providerData?.syncedAt || subscription.updatedAt || null,
          providerData: providerData || {},
        };
      }),
      syncStatus: subscriptions.length ? "synced" : "not_configured",
      lastSyncedAt,
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/webhook-status]", err);
    return NextResponse.json({ message: "Failed to load webhook status" }, { status: 500 });
  }
}
