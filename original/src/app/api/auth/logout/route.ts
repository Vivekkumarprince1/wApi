/**
 * API: /api/auth/logout
 */

import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth-utils";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out successfully" });
  return clearAuthCookie(response);
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/auth/login", request.url));
  clearAuthCookie(response);
  return response;
}
