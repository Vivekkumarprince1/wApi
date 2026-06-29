import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { saveWebhookPolicy } from "@/server/config-ops";
import { internalDeleteJson, internalPost } from "@/server/internal-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gupshup / BSP operations.
 *
 * Self-contained (direct Mongo):
 *   webhook-policy     -> upsert a WebhookPolicy doc directly
 *   developer-config   -> env-managed guidance, persists nothing
 *
 * Service-provider internal admin operations:
 *   reconcile / dashboards-reconcile  -> /internal/v1/bsp/admin/reconcile
 *   sync-webhook                      -> /internal/v1/bsp/admin/sync-webhook/:appId
 *   sync-all-webhooks                 -> /internal/v1/bsp/admin/sync-webhooks
 *   delete-subscription               -> /internal/v1/bsp/admin/subscription/:appId/:subscriptionId
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;

  try {
    const actor = await requireAdmin("operations");
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    let data: unknown;
    let mode: "direct" | "service-provider" = "direct";

    switch (action) {
      case "webhook-policy":
        data = await saveWebhookPolicy(body);
        break;

      case "developer-config":
        data = {
          message:
            "Partner API credentials are managed via environment variables (GUPSHUP_PARTNER_*). Restart the admin portal after changing .env.",
        };
        break;

      case "reconcile":
      case "dashboards-reconcile": {
        mode = "service-provider";
        const res = await internalPost("bsp", "/admin/reconcile", {});
        if (!res.ok) return serviceError(res);
        data = res.data;
        break;
      }

      case "sync-webhook": {
        const appId = String(body.appId || "");
        if (!appId) return NextResponse.json({ message: "appId is required" }, { status: 400 });
        mode = "service-provider";
        const res = await internalPost("bsp", `/admin/sync-webhook/${appId}`, body);
        if (!res.ok) return serviceError(res);
        data = res.data;
        break;
      }

      case "sync-all-webhooks": {
        mode = "service-provider";
        const res = await internalPost("bsp", "/admin/sync-webhooks", body);
        if (!res.ok) return serviceError(res);
        data = res.data;
        break;
      }

      case "delete-subscription": {
        const appId = String(body.appId || "");
        const subscriptionId = String(body.subscriptionId || "");
        if (!appId || !subscriptionId)
          return NextResponse.json({ message: "appId and subscriptionId are required" }, { status: 400 });
        mode = "service-provider";
        const res = await internalDeleteJson("bsp", `/admin/subscription/${appId}/${subscriptionId}`);
        if (!res.ok) return serviceError(res);
        data = res.data;
        break;
      }

      default:
        return NextResponse.json({ message: `Unknown action "${action}"` }, { status: 400 });
    }

    await recordAudit({
      actor,
      action: `gupshup.${action}`,
      target: "gupshup",
      metadata: { payload: body, mode },
      ip: clientIp(req),
      outcome: "success",
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Operation failed";
    console.error(`[admin/ops/gupshup/${action}]`, err);
    return NextResponse.json({ message }, { status: 500 });
  }
}

function serviceError(res: { status: number; error?: string }) {
  const message =
    res.status === 502
      ? "Gupshup partner API is handled by service-provider, which is not reachable. Start the backend services to run this operation."
      : res.error || "Operation failed";
  return NextResponse.json({ message }, { status: res.status });
}
