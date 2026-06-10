import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compliance profile — SELF-CONTAINED. Merges env defaults with any overrides
 * stored under SystemSettings.features.compliance.
 */
export async function GET() {
  try {
    await requireAdmin("read");
    const { SystemSettings } = await coreModels();
    const s = (await SystemSettings.findOne({}).lean()) as Record<string, unknown> | null;
    const overrides = ((s?.features as Record<string, unknown>)?.compliance as Record<string, unknown>) || {};

    return NextResponse.json({
      success: true,
      data: {
        businessVerificationMandatory:
          overrides.businessVerificationMandatory ?? process.env.BUSINESS_VERIFICATION_MANDATORY === "true",
        provider: overrides.provider ?? process.env.BUSINESS_VERIFICATION_PROVIDER ?? "hybrid",
        webhookAuditEnabled: overrides.webhookAuditEnabled ?? true,
        emergencyFreezeEnabled: overrides.emergencyFreezeEnabled ?? true,
      },
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/compliance]", err);
    return NextResponse.json({ message: "Failed to load compliance profile" }, { status: 500 });
  }
}
