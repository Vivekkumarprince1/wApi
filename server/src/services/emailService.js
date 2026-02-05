const nodemailer = require('nodemailer');

// Create transporter based on environment
const createTransporter = () => {
  // Check if email is configured
  if (!process.env.SMTP_HOST && !process.env.EMAIL_SERVICE) {
    console.warn('⚠️ Email service not configured. Set SMTP_HOST or EMAIL_SERVICE in .env');
    return null;
  }

  // Use service-based config (Gmail, Outlook, etc.)
  if (process.env.EMAIL_SERVICE) {
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  // Use SMTP config
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

/**
 * Send email verification OTP/Token
 */
const sendVerificationEmail = async (email, token, userName = '') => {
  const transport = getTransporter();

  if (!transport) {
    console.log(`📧 [DEV MODE] Email verification token for ${email}: ${token}`);
    console.log(`   Verification link: ${process.env.FRONTEND_URL}/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`);
    return { success: true, devMode: true };
  }

  const appName = process.env.APP_NAME || 'Interakt';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  const mailOptions = {
    from: `"${appName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: email,
    subject: `Verify your email - ${appName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #13C18D 0%, #0e8c6c 100%); padding: 30px; text-align: center; border-radius: 16px 16px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${appName}</h1>
                    <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">WhatsApp Business Platform</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 10px; color: #1f2937; font-size: 22px; font-weight: 600;">Verify your email</h2>
                    <p style="margin: 0 0 25px; color: #6b7280; font-size: 15px; line-height: 1.6;">
                      ${userName ? `Hi ${userName},` : 'Hi there,'}<br><br>
                      Please use the verification code below to verify your email address. This code will expire in 10 minutes.
                    </p>
                    
                    <!-- OTP Code -->
                    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 2px dashed #13C18D; border-radius: 12px; padding: 25px; text-align: center; margin: 25px 0;">
                      <p style="margin: 0 0 10px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Your verification code</p>
                      <p style="margin: 0; font-size: 36px; font-weight: 700; color: #13C18D; letter-spacing: 8px; font-family: 'Courier New', monospace;">${token.substring(0, 6).toUpperCase()}</p>
                    </div>
                    
                    <p style="margin: 25px 0 0; color: #9ca3af; font-size: 13px; text-align: center;">
                      If you didn't request this verification, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 30px; background-color: #f9fafb; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                      © ${new Date().getFullYear()} ${appName}. All rights reserved.<br>
                      <a href="${frontendUrl}" style="color: #13C18D; text-decoration: none;">Visit our website</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Your ${appName} verification code is: ${token.substring(0, 6).toUpperCase()}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.`
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`📧 Verification email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send verification email to ${email}:`, error.message);
    throw error;
  }
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, resetToken, userName = '') => {
  const transport = getTransporter();

  if (!transport) {
    console.log(`📧 [DEV MODE] Password reset token for ${email}: ${resetToken}`);
    console.log(`   Reset link: ${process.env.FRONTEND_URL}/auth/reset?token=${resetToken}&email=${encodeURIComponent(email)}`);
    return { success: true, devMode: true };
  }

  const appName = process.env.APP_NAME || 'Interakt';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/auth/reset?token=${resetToken}&email=${encodeURIComponent(email)}`;

  const mailOptions = {
    from: `"${appName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: email,
    subject: `Reset your password - ${appName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #13C18D 0%, #0e8c6c 100%); padding: 30px; text-align: center; border-radius: 16px 16px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${appName}</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 10px; color: #1f2937; font-size: 22px;">Reset your password</h2>
                    <p style="margin: 0 0 25px; color: #6b7280; font-size: 15px; line-height: 1.6;">
                      ${userName ? `Hi ${userName},` : 'Hi there,'}<br><br>
                      We received a request to reset your password. Click the button below to create a new password.
                    </p>
                    
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #13C18D 0%, #0e8c6c 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">Reset Password</a>
                    
                    <p style="margin: 25px 0 0; color: #9ca3af; font-size: 13px;">
                      This link will expire in 1 hour. If you didn't request this, please ignore this email.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 30px; background-color: #f9fafb; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                      © ${new Date().getFullYear()} ${appName}. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Reset your ${appName} password\n\nClick this link to reset your password: ${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`📧 Password reset email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send password reset email to ${email}:`, error.message);
    throw error;
  }
};

/**
 * Send signup OTP email
 */
const sendSignupOTPEmail = async (email, otp) => {
  const transport = getTransporter();

  if (!transport) {
    console.log(`📧 [DEV MODE] Signup OTP for ${email}: ${otp}`);
    return { success: true, devMode: true };
  }

  const appName = process.env.APP_NAME || 'Interakt';

  const mailOptions = {
    from: `"${appName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your signup code - ${appName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #13C18D 0%, #0e8c6c 100%); padding: 30px; text-align: center; border-radius: 16px 16px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${appName}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px; text-align: center;">
                    <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 22px;">Your signup code</h2>
                    <div style="background: #f0fdf4; border: 2px dashed #13C18D; border-radius: 12px; padding: 25px; margin: 20px 0;">
                      <p style="margin: 0; font-size: 40px; font-weight: 700; color: #13C18D; letter-spacing: 12px; font-family: 'Courier New', monospace;">${otp}</p>
                    </div>
                    <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px;">This code expires in 5 minutes.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Your ${appName} signup code is: ${otp}\n\nThis code expires in 5 minutes.`
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`📧 Signup OTP email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send signup OTP email to ${email}:`, error.message);
    throw error;
  }
};

/**
 * Send login OTP email
 */
const sendLoginOTPEmail = async (email, otp, userName = '') => {
  const transport = getTransporter();

  if (!transport) {
    console.log(`📧 [DEV MODE] Login OTP for ${email}: ${otp}`);
    return { success: true, devMode: true };
  }

  const appName = process.env.APP_NAME || 'Interakt';

  const mailOptions = {
    from: `"${appName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your login code - ${appName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #13C18D 0%, #0e8c6c 100%); padding: 30px; text-align: center; border-radius: 16px 16px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${appName}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px; text-align: center;">
                    <h2 style="margin: 0 0 10px; color: #1f2937; font-size: 22px;">Welcome back${userName ? `, ${userName}` : ''}!</h2>
                    <p style="margin: 0 0 20px; color: #6b7280; font-size: 15px;">Use the code below to log in:</p>
                    <div style="background: #f0fdf4; border: 2px dashed #13C18D; border-radius: 12px; padding: 25px; margin: 20px 0;">
                      <p style="margin: 0; font-size: 40px; font-weight: 700; color: #13C18D; letter-spacing: 12px; font-family: 'Courier New', monospace;">${otp}</p>
                    </div>
                    <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px;">This code expires in 5 minutes.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Your ${appName} login code is: ${otp}\n\nThis code expires in 5 minutes.`
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`📧 Login OTP email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send login OTP email to ${email}:`, error.message);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendSignupOTPEmail,
  sendLoginOTPEmail,
  getTransporter
};
