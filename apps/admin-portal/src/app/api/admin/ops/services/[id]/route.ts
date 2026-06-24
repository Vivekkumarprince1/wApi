import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { updateServiceControl } from "@/server/config-ops";
import { getRedis } from "@/server/events";
import { SERVICES } from "@/server/services-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVICE_IDS = new Set(SERVICES.map((service) => service.id));
const SERVICE_CONTROLS_KEY = "platform:service-controls";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!SERVICE_IDS.has(id)) {
    return NextResponse.json({ message: `Unknown service "${id}"` }, { status: 404 });
  }

  try {
    const actor = await requireAdmin("system");
    const payload = await req.json().catch(() => ({} as Record<string, unknown>));

    const data = await updateServiceControl(id, payload);
    const controls = (data as { features?: { serviceControls?: unknown } })?.features?.serviceControls || {};

    try {
      await getRedis().set(SERVICE_CONTROLS_KEY, JSON.stringify(controls));
    } catch (redisErr) {
      console.warn("[admin/ops/services] Failed to sync service controls to Redis:", redisErr);
    }

    await recordAudit({
      actor,
      action: "service.control.update",
      target: "service",
      targetId: id,
      metadata: { payload, mode: "direct" },
      ip: clientIp(req),
      outcome: "success",
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to update service control";
    console.error(`[admin/ops/services/${id}]`, err);
    return NextResponse.json({ message }, { status: 500 });
  }
}
