import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gupshup config — SELF-CONTAINED. Webhook policies read directly from Mongo;
 * developer-config status derived from env (credentials are env-managed).
 */
export async function GET() {
  try {
    await requireAdmin("operations");
    const { WebhookPolicy } = await coreModels();
    const policies = await WebhookPolicy.find({}).sort({ createdAt: -1 }).limit(100).lean();

    const developerConfig = {
      partnerConfigured: Boolean(
        process.env.GUPSHUP_PARTNER_EMAIL &&
        (process.env.GUPSHUP_PARTNER_CLIENT_SECRET || process.env.GUPSHUP_PARTNER_PASSWORD)
      ),
      partnerBaseUrl: process.env.GUPSHUP_PARTNER_BASE_URL || "https://partner.gupshup.io",
      note: "Partner API credentials are managed via GUPSHUP_PARTNER_* environment variables.",
    };

    return NextResponse.json({ developerConfig, webhookPolicies: policies });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/gupshup]", err);
    return NextResponse.json({ message: "Failed to load Gupshup config" }, { status: 500 });
  }
}
