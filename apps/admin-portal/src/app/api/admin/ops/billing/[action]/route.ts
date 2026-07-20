import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { recordAudit, clientIp } from "@/server/audit";
import { createPlan, updatePlan, deletePlan, reconcileBilling, seedDefaultPlans, syncPlanCatalogToBilling } from "@/server/config-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Billing operations.
 *  - Plan CRUD: SELF-CONTAINED direct Mongo writes (plain docs, no side-effects).
 * All operations are owned by the admin control plane; no gateway call.
 */

type Mode = "direct";

async function run(
  action: string,
  payload: Record<string, unknown>
): Promise<{ mode: Mode; data?: unknown }> {
  switch (action) {
    case "create-plan":
      return { mode: "direct", data: await createPlan(payload) };
    case "update-plan":
      return { mode: "direct", data: await updatePlan(String(payload.planId), payload) };
    case "delete-plan":
      await deletePlan(String(payload.planId));
      return { mode: "direct", data: { deleted: true } };
    case "reconcile":
      return { mode: "direct", data: await reconcileBilling() };
    case "seed-plans":
      return { mode: "direct", data: await seedDefaultPlans() };
    case "sync-plans":
      return { mode: "direct", data: await syncPlanCatalogToBilling() };
    default:
      throw new Error(`Unknown action "${action}"`);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;

  try {
    const actor = await requireAdmin("billing");
    const payload = await req.json().catch(() => ({}));

    const outcome = await run(action, payload);

    const data = outcome.data;

    await recordAudit({
      actor,
      action: `billing.${action}`,
      target: "billing",
      metadata: { payload, mode: outcome.mode },
      ip: clientIp(req),
      outcome: "success",
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Operation failed";
    if (message.startsWith("Unknown action")) {
      return NextResponse.json({ message }, { status: 400 });
    }
    console.error(`[admin/ops/billing/${action}]`, err);
    return NextResponse.json({ message }, { status: 500 });
  }
}
