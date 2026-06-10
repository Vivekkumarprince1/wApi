import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { updateSystemSettings } from "@/server/config-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Update compliance profile — SELF-CONTAINED. core-server's compliance profile
 * is largely env-derived; the portal persists overrides under
 * SystemSettings.features.compliance so they survive without env edits.
 */
export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdmin("system");
    const body = await req.json().catch(() => ({}));

    const data = await updateSystemSettings({ features: { compliance: body } });

    await recordAudit({
      actor,
      action: "compliance.update",
      target: "compliance-profile",
      metadata: { payload: body, mode: "direct" },
      ip: clientIp(req),
      outcome: "success",
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/ops/compliance]", err);
    return NextResponse.json({ message: "Failed to update compliance" }, { status: 500 });
  }
}
