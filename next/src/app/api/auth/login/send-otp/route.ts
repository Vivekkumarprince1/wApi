/**
 * API: /api/auth/login/send-otp
 * Port of legacy authController.sendLoginOTP
 */

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db-connect";
import { sendAuthOtp } from "@/lib/services/auth/auth-flow-service";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    await dbConnect();

    const result = await sendAuthOtp({ purpose: 'email_login', identifier: email });

    return NextResponse.json({ message: "OTP sent successfully", success: true, ...result });
  } catch (err: any) {
    console.error("[Login OTP API Error]:", err.message);
    return NextResponse.json({ message: err.message || "Server Error", error: err.message, code: err.code }, { status: err.status || 500 });
  }
}
