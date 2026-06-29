import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin, setAdminCookie } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const result = await authenticateAdmin(body.email || "", body.password || "");

  if (!result.ok || !result.token || !result.session) {
    return NextResponse.json({ message: result.message || "Login failed" }, { status: result.status });
  }

  const { userId, name, email, role } = result.session;
  const response = NextResponse.json({ user: { userId, name, email, role } }, { status: 200 });
  setAdminCookie(response, result.token, req);
  return response;
}
