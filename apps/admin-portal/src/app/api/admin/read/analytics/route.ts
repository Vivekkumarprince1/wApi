import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels, billingModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Platform analytics — computed reads (Rule #4).
 *
 * MRR is derived from active subscriptions joined to their plan's monthly fee.
 * Growth = workspaces created in the last 30 days. Activation = workspaces with
 * WhatsApp connected / total. Churn = canceled+suspended / total subscriptions.
 * ARR = MRR * 12. ARPA = MRR / active subscriptions. These are best-effort from
 * the data the platform stores; CAC needs spend data we don't have, so it is
 * returned as null with a note.
 */
export async function GET() {
  try {
    await requireAdmin("read");

    const { Workspace, Plan } = await coreModels();
    const { Subscription } = await billingModels();

    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [plans, subsByStatus, activeSubs, totalWorkspaces, newWorkspaces, activatedWorkspaces] =
      await Promise.all([
        Plan.find({}).select("_id monthlyBaseFeeCents pricing").lean(),
        Subscription.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        // The monolith stores the plan reference as `plan`; the billing
        // service uses `planId`. Select both so MRR works against either.
        Subscription.find({ status: "active" }).select("planId plan").lean(),
        Workspace.estimatedDocumentCount(),
        Workspace.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        Workspace.countDocuments({ whatsappConnected: true }),
      ]);

    // Plan monthly fee lookup (in minor units / cents).
    const planFee = new Map<string, number>();
    for (const p of plans as Array<Record<string, unknown>>) {
      const fee =
        (typeof p.monthlyBaseFeeCents === "number" ? p.monthlyBaseFeeCents : undefined) ??
        (p.pricing && typeof (p.pricing as Record<string, unknown>).monthlyCents === "number"
          ? ((p.pricing as Record<string, number>).monthlyCents)
          : 0);
      planFee.set(String(p._id), fee || 0);
    }

    let mrrCents = 0;
    for (const s of activeSubs as Array<{ planId?: unknown; plan?: unknown }>) {
      const ref = s.planId ?? s.plan;
      mrrCents += planFee.get(String(ref)) || 0;
    }

    const subCounts: Record<string, number> = {};
    for (const row of subsByStatus) subCounts[row._id || "unknown"] = row.count;
    const totalSubs = Object.values(subCounts).reduce((a, b) => a + b, 0);
    const churned = (subCounts.canceled || 0) + (subCounts.suspended || 0);

    const activeCount = subCounts.active || 0;
    const arpaCents = activeCount > 0 ? Math.round(mrrCents / activeCount) : 0;

    return NextResponse.json({
      revenue: {
        mrrCents,
        arrCents: mrrCents * 12,
        arpaCents,
        currency: "INR",
      },
      subscriptions: subCounts,
      rates: {
        churnRate: totalSubs > 0 ? +(churned / totalSubs).toFixed(4) : 0,
        activationRate: totalWorkspaces > 0 ? +(activatedWorkspaces / totalWorkspaces).toFixed(4) : 0,
      },
      growth: {
        totalWorkspaces,
        newWorkspaces30d: newWorkspaces,
      },
      notes: {
        cac: "Not computed — requires marketing/sales spend data not stored in the platform.",
        ltv: "Approximate LTV = ARPA / churnRate (shown client-side when churn > 0).",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/analytics]", err);
    return NextResponse.json({ message: "Failed to load analytics" }, { status: 500 });
  }
}
