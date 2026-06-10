import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { getConnection } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook subscription status for a workspace — direct read (Rule #4). Mirrors
 * core-server adminController.getWebhookStatus (?workspaceId=...). Reads the
 * locally-stored webhook config (subscribedEvents, syncStatus, lastSyncedAt)
 * for the workspace and presents it as a subscriptions list the UI can render.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin("operations");

    const { searchParams } = new URL(req.url);
    const workspaceId = (searchParams.get("workspaceId") || "").trim();
    if (!workspaceId) {
      return NextResponse.json({ message: "workspaceId is required" }, { status: 400 });
    }

    const conn = await getConnection("core");
    const db = conn.db;
    if (!db) throw new Error("Database handle unavailable");

    let wsRef: Types.ObjectId | string = workspaceId;
    try {
      wsRef = new Types.ObjectId(workspaceId);
    } catch {
      /* keep as string */
    }

    const config = await db
      .collection("webhookconfigs")
      .findOne({ workspace: { $in: [wsRef, workspaceId] } });

    const subscriptions = config
      ? [
          {
            id: String(config._id),
            url: (config as Record<string, unknown>).endpointUrl || "System default",
            modes: (config as Record<string, unknown>).subscribedEvents || [],
            events: (config as Record<string, unknown>).subscribedEvents || [],
          },
        ]
      : [];

    return NextResponse.json({
      workspaceId,
      subscriptions,
      syncStatus: config ? (config as Record<string, unknown>).syncStatus || "unknown" : "not_configured",
      lastSyncedAt: config ? (config as Record<string, unknown>).lastSyncedAt || null : null,
      lastError: config ? (config as Record<string, unknown>).lastError || null : null,
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/webhook-status]", err);
    return NextResponse.json({ message: "Failed to load webhook status" }, { status: 500 });
  }
}
