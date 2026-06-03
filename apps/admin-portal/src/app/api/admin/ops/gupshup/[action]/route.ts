import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { saveWebhookPolicy } from "@/server/config-ops";
import { gatewayCall } from "@/server/gateway-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gupshup / BSP operations.
 *
 * Self-contained (direct Mongo):
 *   webhook-policy     -> upsert a WebhookPolicy doc directly
 *   developer-config   -> env-managed guidance, persists nothing
 *
 * Gateway-routed (need the live Gupshup partner API via core-server; degrade to
 * a clear 502 when services are down):
 *   reconcile / dashboards-reconcile  -> super-admin/gupshup/reconcile
 *   sync-webhook  (body: { appId, url, modes, strategy })
 *                                     -> super-admin/gupshup/sync-webhook/:appId
 *   sync-all-webhooks (body: { url, modes, strategy })
 *                                     -> super-admin/gupshup/sync-all-webhooks
 *   delete-subscription (body: { appId, subscriptionId })
 *                                     -> super-admin/gupshup/subscription/:appId/:subscriptionId (DELETE)
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
    let mode: "direct" | "gateway" = "direct";

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
        mode = "gateway";
        const res = await gatewayCall("super-admin/gupshup/reconcile", { method: "POST", actor });
        if (!res.ok) return gatewayError(res);
        data = res.data;
        break;
      }

      case "sync-webhook": {
        mode = "gateway";
        const appId = String(body.appId || "");
        if (!appId) return NextResponse.json({ message: "appId is required" }, { status: 400 });
        const res = await gatewayCall(`super-admin/gupshup/sync-webhook/${appId}`, {
          method: "POST",
          body,
          actor,
        });
        if (!res.ok) return gatewayError(res);
        data = res.data;
        break;
      }

      case "sync-all-webhooks": {
        mode = "gateway";
        const res = await gatewayCall("super-admin/gupshup/sync-all-webhooks", {
          method: "POST",
          body,
          actor,
        });
        if (!res.ok) return gatewayError(res);
        data = res.data;
        break;
      }

      case "delete-subscription": {
        mode = "gateway";
        const appId = String(body.appId || "");
        const subscriptionId = String(body.subscriptionId || "");
        if (!appId || !subscriptionId)
          return NextResponse.json({ message: "appId and subscriptionId are required" }, { status: 400 });
        const res = await gatewayCall(`super-admin/gupshup/subscription/${appId}/${subscriptionId}`, {
          method: "DELETE",
          actor,
        });
        if (!res.ok) return gatewayError(res);
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

function gatewayError(res: { status: number; error?: string }) {
  const message =
    res.status === 502
      ? "Gupshup partner API is handled by the core service, which is not reachable. Start the backend services to run this operation."
      : res.error || "Operation failed";
  return NextResponse.json({ message }, { status: res.status });
}
