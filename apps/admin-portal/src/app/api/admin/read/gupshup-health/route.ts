import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { getConnection } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gupshup / BSP provider health — direct read from the service-provider-owned
 * `wapi_bsp` database. This avoids a runtime dependency on service-provider.
 */
export async function GET() {
  try {
    await requireAdmin("operations");

    const conn = await getConnection("bsp");
    const db = conn.db;
    if (!db) throw new Error("Database handle unavailable");

    const [whatsappConnected, totalWorkspaces, totalApps, connectedApps, activeSubscriptions, recentWebhookFailures] =
      await Promise.all([
        db.collection("workspaces").countDocuments({ whatsappConnected: true }),
        db.collection("workspaces").estimatedDocumentCount(),
        db.collection("bsp_apps").estimatedDocumentCount(),
        db.collection("bsp_apps").countDocuments({ status: { $in: ["connected", "active"] } }),
        db.collection("bsp_subscriptions").countDocuments({ status: "active" }),
        db.collection("bsp_webhook_events").countDocuments({ status: "failed" }),
      ]);

    const mappedApps = totalApps;
    const orphanedMappings = 0;

    return NextResponse.json({
      mappedApps,
      whatsappConnected,
      orphanedMappings,
      totalWorkspaces,
      totalApps,
      connectedApps,
      activeSubscriptions,
      recentWebhookFailures,
      status: connectedApps > 0 ? "connected" : "idle",
      lastCheckedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/gupshup-health]", err);
    return NextResponse.json({ message: "Failed to load Gupshup health" }, { status: 500 });
  }
}
