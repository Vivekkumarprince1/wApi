import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { internalGet } from "@/server/internal-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook subscription status for a workspace. The authoritative mirror for
 * Gupshup app subscriptions now lives in service-provider `bsp_subscriptions`.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin("operations");

    const { searchParams } = new URL(req.url);
    const workspaceId = (searchParams.get("workspaceId") || "").trim();
    if (!workspaceId) {
      return NextResponse.json({ message: "workspaceId is required" }, { status: 400 });
    }

    const res = await internalGet("bsp", `/admin/webhook-status?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (!res.ok) {
      return NextResponse.json(
        { message: res.error || "Failed to load webhook status from service-provider" },
        { status: res.status },
      );
    }

    const payload = res.data && typeof res.data === "object" ? (res.data as Record<string, unknown>) : {};
    return NextResponse.json(payload.data || payload);
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/webhook-status]", err);
    return NextResponse.json({ message: "Failed to load webhook status" }, { status: 500 });
  }
}
