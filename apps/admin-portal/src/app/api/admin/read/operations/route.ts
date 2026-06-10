import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { campaignModels, automationModels, coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operations overview — SELF-CONTAINED. Campaign & automation snapshots from
 * their DBs; Gupshup/BSP health read directly from the core `gupshupapps`
 * collection (assigned/connected counts) instead of proxying the gateway.
 */
export async function GET() {
  try {
    await requireAdmin("read");

    const { Campaign } = await campaignModels();
    const { AutomationRule } = await automationModels();
    const { Workspace } = await coreModels();
    const coreDb = Workspace.db.db;

    const [campaignsByStatus, automationTotal, automationEnabled, totalApps, connectedApps] =
      await Promise.all([
        Campaign.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        AutomationRule.countDocuments({}),
        AutomationRule.countDocuments({ enabled: true }),
        coreDb ? coreDb.collection("gupshupapps").estimatedDocumentCount() : Promise.resolve(0),
        coreDb
          ? coreDb.collection("gupshupapps").countDocuments({ status: { $in: ["connected", "active"] } })
          : Promise.resolve(0),
      ]);

    const campaigns: Record<string, number> = {};
    for (const row of campaignsByStatus) {
      const key = String(row._id || "unknown").toLowerCase();
      campaigns[key] = (campaigns[key] || 0) + row.count;
    }

    return NextResponse.json({
      campaigns,
      automation: { total: automationTotal, enabled: automationEnabled },
      gupshup: { status: connectedApps > 0 ? "connected" : "idle", totalApps, connectedApps },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/operations]", err);
    return NextResponse.json({ message: "Failed to load operations data" }, { status: 500 });
  }
}
