import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { getConnection } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gupshup / BSP provider health — direct read (Rule #4). Mirrors core-server
 * adminController.gupshupHealth:
 *   - mappedApps         : active business→app mappings
 *   - whatsappConnected  : workspaces with a live WhatsApp connection
 *   - orphanedMappings   : app mappings whose workspace no longer connects
 *   - totalWorkspaces    : all workspaces
 */
export async function GET() {
  try {
    await requireAdmin("operations");

    const conn = await getConnection("core");
    const db = conn.db;
    if (!db) throw new Error("Database handle unavailable");

    const [mappedApps, whatsappConnected, totalWorkspaces, totalApps, connectedApps, activeMaps] =
      await Promise.all([
        db.collection("businessappmaps").countDocuments({ active: true }),
        db.collection("workspaces").countDocuments({ whatsappConnected: true }),
        db.collection("workspaces").estimatedDocumentCount(),
        db.collection("gupshupapps").estimatedDocumentCount(),
        db.collection("gupshupapps").countDocuments({ status: { $in: ["connected", "active"] } }),
        db.collection("businessappmaps").countDocuments({ active: true, workspace: { $ne: null } }),
      ]);

    // Orphaned = active mappings without a usable workspace link.
    const orphanedMappings = Math.max(0, mappedApps - activeMaps);

    return NextResponse.json({
      mappedApps,
      whatsappConnected,
      orphanedMappings,
      totalWorkspaces,
      totalApps,
      connectedApps,
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
