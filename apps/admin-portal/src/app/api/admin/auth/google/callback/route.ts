import { NextRequest, NextResponse } from "next/server";

import { config } from "@/config/env";
import { authenticateAdminGoogle, setAdminCookie } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!config.googleAuthEnabled || !config.services.auth) {
    return NextResponse.json({ message: "Google sign-in is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  if (!body?.code) return NextResponse.json({ message: "Missing Google authorization code" }, { status: 400 });

  const redirectUri = `${config.publicAppUrl.replace(/\/$/, "")}/auth/google/callback`;
  try {
    const upstream = await fetch(`${config.services.auth}/google/admin/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: body.code, redirectUri }),
      cache: "no-store",
    });
    const upstreamBody = (await upstream.json().catch(() => null)) as {
      user?: { email?: string };
      message?: string;
    } | null;
    if (!upstream.ok || !upstreamBody?.user?.email) {
      return NextResponse.json(
        { message: upstreamBody?.message ?? "Unable to complete Google sign-in" },
        { status: upstream.status || 502 },
      );
    }

    const result = await authenticateAdminGoogle(upstreamBody.user.email);
    if (!result.ok || !result.token || !result.session) {
      return NextResponse.json(
        { message: result.message ?? "This account is not authorized for the admin portal" },
        { status: result.status },
      );
    }

    const { userId, name, email, role } = result.session;
    const response = NextResponse.json({ user: { userId, name, email, role } });
    setAdminCookie(response, result.token, request);
    return response;
  } catch {
    return NextResponse.json({ message: "Google sign-in is temporarily unavailable" }, { status: 502 });
  }
}
