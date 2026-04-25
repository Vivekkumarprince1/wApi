/**
 * API: /api/auth/signup/verify-otp
 * Port of legacy authController.verifySignupOTP
 * Handles creation of User, Workspace, and initial Permissions.
 */

import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth-utils";
import dbConnect from "@/lib/db-connect";
import { verifyAuthOtp } from "@/lib/services/auth/auth-flow-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and OTP are required" }, { status: 400 });
    }

    await dbConnect();
    const result = await verifyAuthOtp({ purpose: 'signup_email', identifier: email, otp });

    const response = NextResponse.json({
      message: "Signup successful",
      authenticated: true,
      user: result.user,
      nextStep: result.nextStep
    });

    return setAuthCookie(response, result.token);
  } catch (err: any) {
    console.error("[Signup Verify OTP Error]:", err.message);
    return NextResponse.json({ message: err.message || "Server Error", error: err.message, code: err.code }, { status: err.status || 500 });
  }
}
