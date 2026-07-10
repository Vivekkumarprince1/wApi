import nodemailer from 'nodemailer';
import config from '../config/index.js';

let mailTransporterPromise: Promise<nodemailer.Transporter> | null = null;

export const getMailTransporter = async () => {
  if (!mailTransporterPromise) {
    const smtpHost = config.smtpHost;
    const smtpPort = config.smtpPort;
    const smtpSecure = config.env === 'production' || smtpPort === 465;
    const smtpUser = config.smtpUser;
    const smtpPass = (config.smtpPass || '').replace(/\s+/g, '');

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in auth-service/.env');
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    mailTransporterPromise = transporter.verify().then(() => transporter);
  }

  return mailTransporterPromise;
};

export const sendSignupOtpEmail = async (email: string, name: string, otp: string) => {
  const transporter = await getMailTransporter();
  const from = config.smtpFrom || config.smtpUser || 'no-reply@local.connectsphere';
  const ttlLabel = `${config.signupOtpTtlMinutes} minute${config.signupOtpTtlMinutes === 1 ? '' : 's'}`;
  await transporter.sendMail({
    from,
    to: email,
    subject: 'Your verification code',
    text: `Hi ${name},\n\nYour verification code is: ${otp}\nThis code expires in ${ttlLabel}.\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hi ${name},</p><p>Your verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:2px;">${otp}</p><p>This code expires in ${ttlLabel}.</p><p>If you did not request this, you can ignore this email.</p>`,
  });
};
