import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { sendAuthOtp } from '@/lib/services/auth/auth-flow-service';
import { getOptionalRequestUser } from '@/lib/services/auth/request-auth';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const currentUser = await getOptionalRequestUser(req);
    const purpose = currentUser ? 'email_verification' : 'signup_email';
    const result = await sendAuthOtp({
      purpose,
      identifier: body.email || currentUser?.email,
      name: body.name,
      password: body.password,
      currentUser
    });
    return NextResponse.json({ success: true, message: 'OTP sent successfully', ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message, code: error.code }, { status: error.status || 500 });
  }
}
