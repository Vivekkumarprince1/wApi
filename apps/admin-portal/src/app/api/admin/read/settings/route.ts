import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { coreModels } from "@/server/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Platform settings — SELF-CONTAINED, read the SystemSettings singleton + env. */
export async function GET() {
  try {
    await requireAdmin("read");
    const { SystemSettings } = await coreModels();
    const s = (await SystemSettings.findOne({}).lean()) || {};

    return NextResponse.json({
      success: true,
      data: {
        appName: process.env.NEXT_PUBLIC_APP_NAME || "wApi",
        maintenanceMode: (s as Record<string, unknown>).maintenanceMode || false,
        maintenanceMessage: (s as Record<string, unknown>).maintenanceMessage || "",
        allowNewSignups: (s as Record<string, unknown>).allowNewSignups !== false,
        systemNotice: (s as Record<string, unknown>).systemNotice || null,
        features: (s as Record<string, unknown>).features || {},
      },
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/settings]", err);
    return NextResponse.json({ message: "Failed to load settings" }, { status: 500 });
  }
}
