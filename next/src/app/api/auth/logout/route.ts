/**
 * API: /api/auth/logout
 */

import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth-utils";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out successfully" });
  return clearAuthCookie(response);
}

export async function GET() {
  const response = NextResponse.redirect(new URL("/auth/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5001"));
  clearAuthCookie(response);
  return response;
}
