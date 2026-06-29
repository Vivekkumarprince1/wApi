import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearAdminCookie } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ ok: true });
  clearAdminCookie(response, req);
  return response;
}
