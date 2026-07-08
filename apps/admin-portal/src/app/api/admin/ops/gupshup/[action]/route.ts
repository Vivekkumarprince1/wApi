import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { saveWebhookPolicy } from "@/server/config-ops";
import { internalDeleteJson, internalGet, internalPost } from "@/server/internal-client";

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
 *   sync-app-subscriptions            -> /internal/v1/bsp/admin/sync-app-subscriptions/:appId
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
        mode = "service-provider";
        const resolved = await resolveBspAppId(body);
        if (!resolved.ok) return serviceError(resolved.res);
        const { appId } = resolved;
        if (!appId) {
          data = { skipped: true, message: "No live Gupshup app is linked to this workspace yet." };
          break;
        }
        const res = await internalPost("bsp", `/admin/sync-webhook/${encodeURIComponent(appId)}`, {
          ...body,
          appId,
        });
        if (!res.ok) return serviceError(res);
        data = res.data;
        break;
      }

      case "sync-app-subscriptions": {
        mode = "service-provider";
        const resolved = await resolveBspAppId(body);
        if (!resolved.ok) return serviceError(resolved.res);
        const { appId } = resolved;
        if (!appId) {
          data = { skipped: true, message: "No live Gupshup app is linked to this workspace yet." };
          break;
        }
        const res = await internalPost("bsp", `/admin/sync-app-subscriptions/${encodeURIComponent(appId)}`, {
          ...body,
          appId,
        });
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
      ? `Gupshup operations are handled by service-provider, which is not reachable from admin-portal. Check SERVICE_PROVIDER_URL/GATEWAY_URL, service ingress, and service-provider health.${res.error ? ` Upstream error: ${res.error}` : ""}`
      : res.error || "Operation failed";
  return NextResponse.json({ message }, { status: res.status });
}

async function resolveBspAppId(
  body: Record<string, unknown>
): Promise<{ ok: true; appId: string } | { ok: false; res: { status: number; error?: string } }> {
  const explicitAppId = normalizeId(body.appId);
  const workspaceId = normalizeId(body.workspaceId);
  if (explicitAppId && !isPlaceholderAppId(explicitAppId)) return { ok: true, appId: explicitAppId };
  if (!workspaceId) return { ok: true, appId: "" };

  const res = await internalGet("bsp", `/admin/apps?workspaceId=${encodeURIComponent(workspaceId)}`);
  if (!res.ok) return { ok: false, res };

  const apps = extractDataArray(res.data);
  const app = apps.find((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    return !isPlaceholderAppId(providerAppId(candidate as Record<string, unknown>));
  });
  if (!app || typeof app !== "object") return { ok: true, appId: "" };

  return { ok: true, appId: providerAppId(app as Record<string, unknown>) };
}

function normalizeId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function providerAppId(record: Record<string, unknown>): string {
  return (
    normalizeId(record.gupshupAppId) ||
    normalizeId((record.gupshupIdentity as Record<string, unknown> | undefined)?.partnerAppId) ||
    normalizeId(record.appId)
  );
}

function isPlaceholderAppId(appId: string): boolean {
  return !appId || appId.startsWith("mock_") || appId.startsWith("pending_");
}

function extractDataArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  return Array.isArray(record.data) ? record.data : [];
}
