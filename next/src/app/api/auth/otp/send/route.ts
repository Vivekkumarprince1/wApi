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
      purpose: body.purpose,
      identifier: body.identifier || body.email || body.phone,
      name: body.name,
      password: body.password,
      requestIp,
      currentUser
    });

    return NextResponse.json({ success: true, message: 'OTP sent successfully', ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to send OTP', code: error.code },
      { status: error.status || 500 }
    );
  }
}
