import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { saveWebhookPolicy } from "@/server/config-ops";
import {
  deleteBspSubscription,
  reconcileBspApps,
  resolveBspAppIdDirect,
  syncAllWebhooks,
  syncAppSubscriptions,
  syncWebhook,
} from "@/server/bsp-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gupshup / BSP operations.
 *
 * Self-contained (direct Mongo):
 *   webhook-policy     -> upsert a WebhookPolicy doc directly
 *   developer-config   -> env-managed guidance, persists nothing
 *
 * Provider operations are executed by the admin portal server using Gupshup's
 * API and the `wapi_bsp` database. Browser code never receives credentials.
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
    const mode = "admin-control-plane";

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
        data = await reconcileBspApps(normalizeId(body.workspaceId) || undefined);
        break;
      }

      case "sync-webhook": {
        const appId = await resolveBspAppIdDirect(body.appId, body.workspaceId);
        if (!appId) {
          data = { skipped: true, message: "No live Gupshup app is linked to this workspace yet." };
          break;
        }
        data = await syncWebhook(appId, body);
        break;
      }

      case "sync-app-subscriptions": {
        const appId = await resolveBspAppIdDirect(body.appId, body.workspaceId);
        if (!appId) {
          data = { skipped: true, message: "No live Gupshup app is linked to this workspace yet." };
          break;
        }
        data = await syncAppSubscriptions(appId, normalizeId(body.workspaceId) || undefined);
        break;
      }

      case "sync-all-webhooks": {
        data = await syncAllWebhooks(body);
        break;
      }

      case "delete-subscription": {
        const appId = String(body.appId || "");
        const subscriptionId = String(body.subscriptionId || "");
        if (!appId || !subscriptionId)
          return NextResponse.json({ message: "appId and subscriptionId are required" }, { status: 400 });
        data = await deleteBspSubscription(appId, subscriptionId);
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

function normalizeId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
