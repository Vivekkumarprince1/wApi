import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { updateSystemSettings } from "@/server/config-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Update platform settings (incl. maintenance mode) — SELF-CONTAINED direct write (system). */
export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdmin("system");
    const body = await req.json().catch(() => ({}));

    const data = await updateSystemSettings(body);

    await recordAudit({
      actor,
      action: "settings.update",
      target: "system-settings",
      metadata: { payload: body, mode: "direct" },
      ip: clientIp(req),
      outcome: "success",
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/ops/settings]", err);
    return NextResponse.json({ message: "Failed to update settings" }, { status: 500 });
  }
}
