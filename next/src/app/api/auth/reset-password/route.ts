import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { User } from '@/lib/models';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '@/lib/config';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ success: false, message: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, message: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      return NextResponse.json({ success: false, message: 'Invalid or expired reset token' }, { status: 400 });
    }

    if (!decoded || decoded.purpose !== 'password_reset' || !decoded.id) {
      return NextResponse.json({ success: false, message: 'Invalid reset token' }, { status: 400 });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Update password
    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();

    return NextResponse.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error: any) {
    console.error('[ResetPassword] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
