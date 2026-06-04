import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { repairSubscriptions } from "@/server/workspace-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Repair entitlement drift — SELF-CONTAINED direct write (system capability).
 * Re-applies each workspace's plan feature set onto its effective entitlements
 * so they match the plan catalogue. Body: { workspaceId? } to scope to one.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin("system");
    const body = await req.json().catch(() => ({}));
    const workspaceId = body?.workspaceId as string | undefined;

    const results = await repairSubscriptions(workspaceId);

    await recordAudit({
      actor,
      action: "platform.repair-entitlements",
      target: workspaceId ? "workspace" : "platform",
      targetId: workspaceId,
      metadata: { results, mode: "direct" },
      ip: clientIp(req),
      outcome: "success",
    });

    return NextResponse.json({
      ok: true,
      message: `Repair complete. Repaired ${results.repaired} of ${results.processed} scanned.`,
      results,
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Repair failed";
    console.error("[admin/ops/repair]", err);
    return NextResponse.json({ message }, { status: 500 });
  }
}
