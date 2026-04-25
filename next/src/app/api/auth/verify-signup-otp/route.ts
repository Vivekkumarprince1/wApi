import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { setAuthCookie } from '@/lib/auth-utils';
import { verifyAuthOtp } from '@/lib/services/auth/auth-flow-service';
import { getOptionalRequestUser } from '@/lib/services/auth/request-auth';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const currentUser = await getOptionalRequestUser(req);
    const purpose = currentUser && !body.email ? 'email_verification' : 'signup_email';
    const result = await verifyAuthOtp({
      purpose,
      identifier: body.email || currentUser?.email,
      otp: body.otp,
      currentUser
    });
    const response = NextResponse.json({
      success: true,
      authenticated: true,
      user: result.user,
      nextStep: result.nextStep,
      message: 'OTP verified successfully'
    });
    return setAuthCookie(response, result.token);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message, code: error.code }, { status: error.status || 500 });
  }
}
