/**
 * API: /api/auth/signup/send-otp
 * Port of legacy authController.sendSignupOTP
 */

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db-connect";
import { sendAuthOtp } from "@/lib/services/auth/auth-flow-service";

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json();

    if (!email || !name || !password) {
      return NextResponse.json({ message: "Name, email and password are required" }, { status: 400 });
    }

    await dbConnect();

    const result = await sendAuthOtp({ purpose: 'signup_email', identifier: email, name, password });

    return NextResponse.json({ message: "OTP sent successfully", success: true, ...result });
  } catch (err: any) {
    console.error("[Signup OTP API Error]:", err.message);
    return NextResponse.json({ message: err.message || "Server Error", error: err.message, code: err.code }, { status: err.status || 500 });
  }
}
