import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entitlement-drift report — direct read (Rule #4). Mirrors core-server
 * adminController.getEntitlementDrift: compares each workspace's effective plan
 * features against its plan's catalogue features and surfaces the deltas.
 *
 * The monolith stores feature overrides on the workspace under planLimits /
 * settings; the canonical expected set is the plan's `features`. We report
 * features the plan grants that the workspace is missing (and vice-versa).
 */
export async function GET() {
  try {
    await requireAdmin("read");

    const { Plan, Workspace } = await coreModels();

    const [plans, workspaces] = await Promise.all([
      Plan.find({}).select("name slug features").lean(),
      Workspace.find({})
        .select("name plan planLimits settings")
        .populate("plan", "name slug features")
        .lean(),
    ]);

    const planMap = new Map(
      (plans as Array<Record<string, unknown>>).map((p) => [String(p._id), p])
    );

    const drift = (workspaces as Array<Record<string, unknown>>).map((ws) => {
      const planRef = ws.plan as Record<string, unknown> | string | undefined;
      const planId = planRef && typeof planRef === "object" ? String(planRef._id) : String(planRef || "");
      const plan =
        planRef && typeof planRef === "object" ? planRef : planMap.get(planId) || null;

      const expectedFeatures: string[] = Array.isArray((plan as Record<string, unknown>)?.features)
        ? ((plan as Record<string, unknown>).features as string[])
        : [];

      // The workspace's effective features: explicit override list if present,
      // else assume it inherits the plan's catalogue (no drift).
      const limits = (ws.planLimits || {}) as Record<string, unknown>;
      const currentFeatures: string[] = Array.isArray(limits.features)
        ? (limits.features as string[])
        : expectedFeatures;

      const missingFeatures = expectedFeatures.filter((f) => !currentFeatures.includes(f));
      const extraFeatures = currentFeatures.filter((f) => !expectedFeatures.includes(f));

      return {
        workspaceId: String(ws._id),
        workspaceName: ws.name,
        planName: (plan as Record<string, unknown>)?.name || "Unassigned",
        missingFeatures,
        extraFeatures,
        driftScore: missingFeatures.length + extraFeatures.length,
      };
    });

    const drifted = drift.filter((d) => d.driftScore > 0);

    return NextResponse.json({
      data: drifted,
      summary: { scanned: drift.length, drifted: drifted.length },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/entitlement-drift]", err);
    return NextResponse.json({ message: "Failed to compute entitlement drift" }, { status: 500 });
  }
}
