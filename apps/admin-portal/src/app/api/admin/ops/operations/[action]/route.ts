import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { gatewayCall } from "@/server/gateway-client";
import { recordAudit, clientIp } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operations actions — WRITE path (Rule #5) → gateway → core-server.
 *
 *   gupshup-reconcile     POST super-admin/gupshup/reconcile
 *   sync-all-webhooks     POST super-admin/gupshup/sync-all-webhooks
 */

const ACTIONS: Record<string, { gatewayPath: string }> = {
  "gupshup-reconcile": { gatewayPath: "super-admin/gupshup/reconcile" },
  "sync-all-webhooks": { gatewayPath: "super-admin/gupshup/sync-all-webhooks" },
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  const config = ACTIONS[action];
  if (!config) {
    return NextResponse.json({ message: `Unknown action "${action}"` }, { status: 400 });
  }

  try {
    const actor = await requireAdmin("operations");
    const result = await gatewayCall(config.gatewayPath, { method: "POST", actor });

    await recordAudit({
      actor,
      action: `operations.${action}`,
      target: "operations",
      metadata: { gatewayStatus: result.status },
      ip: clientIp(req),
      outcome: result.ok ? "success" : "failure",
    });

    if (!result.ok) {
      return NextResponse.json({ message: result.error || "Operation failed" }, { status: result.status });
    }
    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error(`[admin/ops/operations/${action}]`, err);
    return NextResponse.json({ message: "Operation failed" }, { status: 500 });
  }
}
