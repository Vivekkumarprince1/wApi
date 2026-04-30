import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { User } from '@/lib/models';
import { MailService } from '@/lib/services/shared/mail-service';
import jwt from 'jsonwebtoken';
import { config } from '@/lib/config';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email is required' }, { status: 400 });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    console.log(`[RequestPasswordReset] User lookup for ${email}: ${user ? 'Found' : 'Not Found'}`);

    // Always return success to avoid email enumeration
    if (!user) {
      return NextResponse.json({ success: true, message: 'If an account exists with this email, you will receive password reset instructions shortly.' });
    }

    // Generate a reset token (JWT) valid for 1 hour
    const resetToken = jwt.sign(
      { id: user._id, purpose: 'password_reset' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const resetUrl = `${config.baseUrl || 'http://localhost:5001'}/auth/reset?token=${resetToken}`;

    await MailService.sendMail({
      to: user.email!,
      subject: 'Reset your wApi password',
      text: `Hello ${user.name},\n\nYou requested to reset your password. Click the link below to set a new password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #25D366;">Reset Your Password</h2>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>You requested to reset your password for your wApi account. Click the button below to set a new password:</p>
          <div style="margin: 30px 0;">
            <a href="${resetUrl}" style="background: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p>This link will expire in <strong>1 hour</strong>.</p>
          <p style="color: #6b7280; font-size: 0.875rem;">If you did not request this reset, you can safely ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 0.75rem;">If you're having trouble clicking the button, copy and paste the link below into your web browser:</p>
          <p style="color: #9ca3af; font-size: 0.75rem; word-break: break-all;">${resetUrl}</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: 'If an account exists with this email, you will receive password reset instructions shortly.' });
  } catch (error: any) {
    console.error('[RequestPasswordReset] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
