import { NextResponse } from "next/server";
import { getAdminSession } from "@/server/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const { userId, name, email, role } = session;
  return NextResponse.json({
    authenticated: true,
    user: { userId, name, email, role },
  });
}
