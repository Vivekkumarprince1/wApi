import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { internalPost } from "@/server/internal-client";
import { recordAudit, clientIp } from "@/server/audit";
import { reconcileBspApps, syncAllWebhooks } from "@/server/bsp-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operations actions — WRITE path (Rule #5).
 *
 * Admin control-plane:
 *   gupshup-reconcile       direct provider API + wapi_bsp
 *   sync-all-webhooks       direct provider API + wapi_bsp
 * Runtime service operation:
 *   replay-dead-webhooks    POST webhook-ingestor /internal/v1/webhooks/replay
 */

type ActionConfig =
  | { mode: "admin-bsp"; operation: "reconcile" | "sync-all-webhooks" }
  | { mode: "internal"; service: "ingestor"; path: string; body?: unknown };

const ACTIONS: Record<string, ActionConfig> = {
  "gupshup-reconcile": { mode: "admin-bsp", operation: "reconcile" },
  "sync-all-webhooks": { mode: "admin-bsp", operation: "sync-all-webhooks" },
  "replay-dead-webhooks": { mode: "internal", service: "ingestor", path: "/internal/v1/webhooks/replay", body: { limit: 100 } },
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
    const result = config.mode === "admin-bsp"
      ? {
          ok: true,
          status: 200,
          data: config.operation === "reconcile"
            ? await reconcileBspApps()
            : await syncAllWebhooks({}),
        }
      : await internalPost(config.service, config.path, config.body ?? {});

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
