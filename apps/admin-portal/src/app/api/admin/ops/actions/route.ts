import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { updateSystemSettings } from "@/server/config-ops";
import { getRedis } from "@/server/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Platform admin actions — mirrors core-server adminController.executeAction.
 * Body: { action, payload? }.
 *
 *   clear-cache       -> flush the platform Redis cache (best-effort)
 *   broadcast         -> set SystemSettings.systemNotice { message, level, active }
 *   maintenance-mode  -> set SystemSettings.maintenanceMode (+ message)
 *   emergency-freeze   -> set SystemSettings.features.emergencyLockdown (+ reason)
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin("system");
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = String(body.action || "");
    const payload = (body.payload || {}) as Record<string, unknown>;

    let data: unknown;

    switch (action) {
      case "clear-cache": {
        try {
          const redis = getRedis();
          // FLUSHDB on the shared cache. Best-effort — never throws to caller.
          await redis.flushdb();
          data = { cleared: true };
        } catch (e) {
          data = { cleared: false, error: e instanceof Error ? e.message : "redis unavailable" };
        }
        break;
      }
      case "broadcast": {
        data = await updateSystemSettings({
          systemNotice: {
            message: String(payload.message || body.message || ""),
            level: String(payload.level || body.level || "info"),
            active: payload.active !== false && body.active !== false,
            updatedAt: new Date(),
          },
        });
        break;
      }
      case "maintenance-mode": {
        data = await updateSystemSettings({
          maintenanceMode: Boolean(payload.enabled ?? body.enabled),
          maintenanceMessage: String(payload.message || body.message || ""),
        });
        break;
      }
      case "emergency-freeze": {
        const existing = (payload.enabled ?? body.enabled) as boolean | undefined;
        data = await updateSystemSettings({
          features: {
            emergencyLockdown: {
              active: Boolean(existing),
              reason: String(payload.reason || body.reason || ""),
              updatedAt: new Date(),
            },
          },
        });
        break;
      }
      default:
        return NextResponse.json({ message: `Unknown action "${action}"` }, { status: 400 });
    }

    await recordAudit({
      actor,
      action: `platform.${action}`,
      target: "platform",
      metadata: { payload, mode: "direct" },
      ip: clientIp(req),
      outcome: "success",
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Action failed";
    console.error("[admin/ops/actions]", err);
    return NextResponse.json({ message }, { status: 500 });
  }
}
