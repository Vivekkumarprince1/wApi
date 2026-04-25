/**
 * API: /api/auth/login
 * Port of legacy authController.login
 */

import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth-utils";
import dbConnect from "@/lib/db-connect";
import { loginWithPassword } from "@/lib/services/auth/auth-flow-service";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    await dbConnect();

    const result = await loginWithPassword(email, password);

    // Set cookie and return response
    const response = NextResponse.json({ 
      token: result.token,
      authenticated: true,
      user: result.user,
      nextStep: result.nextStep
    });
    
    return setAuthCookie(response, result.token);
  } catch (err: any) {
    console.error("[Login API Error]:", err.message);
    return NextResponse.json({ message: err.message || "Server Error", error: err.message }, { status: err.status || 500 });
  }
}
