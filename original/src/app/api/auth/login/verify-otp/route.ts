/**
 * API: /api/auth/login/verify-otp
 * Port of legacy authController.verifyLoginOTP
 */

import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth-utils";
import dbConnect from "@/lib/db-connect";
import { verifyAuthOtp } from "@/lib/services/auth/auth-flow-service";

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and OTP are required" }, { status: 400 });
    }

    await dbConnect();
    const result = await verifyAuthOtp({ purpose: 'email_login', identifier: email, otp });

    const response = NextResponse.json({
      message: "Login successful",
      authenticated: true,
      user: result.user,
      nextStep: result.nextStep
    });

    return setAuthCookie(response, result.token);
  } catch (err: any) {
    console.error("[Login Verify OTP Error]:", err.message);
    return NextResponse.json({ message: err.message || "Server Error", error: err.message, code: err.code }, { status: err.status || 500 });
  }
}
