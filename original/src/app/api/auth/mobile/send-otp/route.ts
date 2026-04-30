import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { sendAuthOtp } from '@/lib/services/auth/auth-flow-service';
import { getOptionalRequestUser } from '@/lib/services/auth/request-auth';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const requestIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined;
    const currentUser = await getOptionalRequestUser(req);
    const result = await sendAuthOtp({
      purpose: 'phone_verification',
      identifier: body.phone,
      requestIp,
      currentUser
    });
    return NextResponse.json({ success: true, message: 'Verification code sent to your mobile number', ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message, code: error.code }, { status: error.status || 500 });
  }
}
