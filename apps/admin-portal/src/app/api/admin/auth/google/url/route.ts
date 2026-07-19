import { NextResponse } from "next/server";

import { config } from "@/config/env";

export const runtime = "nodejs";

export async function GET() {
  if (!config.googleAuthEnabled || !config.services.auth) {
    return NextResponse.json({ message: "Google sign-in is not configured" }, { status: 503 });
  }

  const redirectUri = `${config.publicAppUrl.replace(/\/$/, "")}/auth/google/callback`;
  const url = new URL(`${config.services.auth}/google/url`);
  url.searchParams.set("type", "admin");
  url.searchParams.set("redirectUri", redirectUri);

  try {
    const upstream = await fetch(url, { cache: "no-store" });
    const body = (await upstream.json().catch(() => null)) as {
      url?: string;
      message?: string;
      error?: { message?: string };
    } | null;
    if (!upstream.ok || !body?.url) {
      return NextResponse.json(
        { message: body?.error?.message ?? body?.message ?? "Unable to start Google sign-in" },
        { status: upstream.status || 502 },
      );
    }
    return NextResponse.json({ url: body.url });
  } catch {
    return NextResponse.json({ message: "Google sign-in is temporarily unavailable" }, { status: 502 });
  }
}
