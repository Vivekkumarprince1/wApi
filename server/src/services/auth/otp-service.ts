import crypto from 'crypto';
import axios from 'axios';
import { OtpChallenge, type OtpPurpose } from '@/models';
import { config } from '@/config';
import { GupshupService } from '@/services/messaging/gupshup-service';
import { maskIdentifier, normalizeEmail, normalizePhone } from './account-service';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_IDENTIFIER_SENDS_PER_HOUR = 8;
const MAX_IP_SENDS_PER_HOUR = 20;

export function getOtpChannel(purpose: OtpPurpose) {
  return purpose.startsWith('phone') ? 'phone' : 'email';
}

export function normalizeOtpIdentifier(identifier: string, purpose: OtpPurpose) {
  const channel = getOtpChannel(purpose);
  return channel === 'phone' ? normalizePhone(identifier) : normalizeEmail(identifier);
}

export function hashOtp(otp: string, identifier: string, purpose: OtpPurpose) {
  return crypto
    .createHmac('sha256', config.otpPepper)
    .update(`${purpose}:${identifier}:${otp}`)
    .digest('hex');
}

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

async function sendEmailOtp(identifier: string, otp: string, purpose: OtpPurpose) {
  if (config.smtpService && config.smtpUser && config.smtpPass) {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      service: config.smtpService,
      auth: { user: config.smtpUser, pass: config.smtpPass }
    });

    await transporter.sendMail({
      from: config.smtpFrom,
      to: identifier,
      subject: purpose === 'signup_email' ? 'Verify your wApi account' : 'Your wApi verification code',
      text: `Your verification code is ${otp}. It expires in 5 minutes.`
    });
    return;
  }

  if (config.smtpHost && config.smtpUser && config.smtpPass) {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass }
    });

    await transporter.sendMail({
      from: config.smtpFrom,
      to: identifier,
      subject: purpose === 'signup_email' ? 'Verify your wApi account' : 'Your wApi verification code',
      text: `Your verification code is ${otp}. It expires in 5 minutes.`
    });
    return;
  }

  if (config.env === 'production') {
    throw Object.assign(new Error('Email OTP delivery is not configured'), { status: 503, code: 'EMAIL_DELIVERY_NOT_CONFIGURED' });
  }

  console.log(`[OTP][email][${purpose}] ${identifier}: ${otp}`);
}

async function sendPhoneOtpViaGupshup(identifier: string, otp: string) {
  if (!config.gupshupAppId || !config.gupshupApiKey || !config.gupshupOtpTemplateName) {
    throw new Error('Gupshup OTP template is not configured');
  }

  const result = await GupshupService.sendTemplate(
    config.gupshupAppId,
    undefined,
    identifier,
    config.gupshupOtpTemplateName,
    'en',
    [{
      type: 'body',
      parameters: [{ type: 'text', text: otp }]
    }]
  );

  if (!result.success) {
    throw new Error(result.error || 'Gupshup OTP failed');
  }
}

async function sendPhoneOtpViaMsg91(identifier: string, otp: string) {
  if (!config.msg91AuthKey || !config.msg91OtpTemplateId) {
    throw new Error('MSG91 OTP fallback is not configured');
  }

  await axios.get('https://control.msg91.com/api/v5/otp', {
    params: {
      authkey: config.msg91AuthKey,
      template_id: config.msg91OtpTemplateId,
      mobile: identifier,
      otp,
      sender: config.msg91SenderId || undefined
    },
    timeout: 10000
  });
}

async function sendPhoneOtpViaTwilio(identifier: string, otp: string) {
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioSenderPhone) {
    throw new Error('Twilio SMS is not configured');
  }

  const twilio = await import('twilio');
  const client = twilio.default(config.twilioAccountSid, config.twilioAuthToken);

  await client.messages.create({
    body: `Your verification code is ${otp}. It expires in 5 minutes.`,
    from: config.twilioSenderPhone,
    to: identifier
  });
}

async function sendPhoneOtp(identifier: string, otp: string, purpose: OtpPurpose) {
  try {
    // 1. Try Twilio SMS
    await sendPhoneOtpViaTwilio(identifier, otp);
    return 'twilio_sms';
  } catch (twilioError: any) {
    try {
      // 2. Fallback to Gupshup WhatsApp
      await sendPhoneOtpViaGupshup(identifier, otp);
      return 'gupshup_whatsapp';
    } catch (gupshupError: any) {
      try {
        // 3. Final fallback to MSG91 SMS
        await sendPhoneOtpViaMsg91(identifier, otp);
        return 'msg91_sms';
      } catch (fallbackError: any) {
        if (config.env !== 'production') {
          console.log(`[OTP][phone][${purpose}] ${identifier}: ${otp}`);
          console.error('[OTP][TWILIO_FAIL]', twilioError.message);
          console.error('[OTP][GUPSHUP_FAIL]', gupshupError.message);
          return 'console';
        }
        throw Object.assign(new Error(fallbackError.message || 'Phone OTP delivery failed'), {
          status: 503,
          code: 'PHONE_DELIVERY_FAILED'
        });
      }
    }
  }
}

export async function createAndSendOtp(input: {
  identifier: string;
  purpose: OtpPurpose;
  metadata?: Record<string, unknown>;
}) {
  const identifier = normalizeOtpIdentifier(input.identifier, input.purpose);
  if (!identifier) {
    throw Object.assign(new Error('A valid identifier is required'), { status: 400, code: 'INVALID_IDENTIFIER' });
  }

  const requestIp = String(input.metadata?.requestIp || '').trim();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const sentForIdentifierLastHour = await OtpChallenge.countDocuments({
    identifier,
    purpose: input.purpose,
    createdAt: { $gte: oneHourAgo }
  });
  if (sentForIdentifierLastHour >= MAX_IDENTIFIER_SENDS_PER_HOUR) {
    throw Object.assign(new Error('Too many OTP requests. Please try again later.'), {
      status: 429,
      code: 'OTP_IDENTIFIER_RATE_LIMITED'
    });
  }

  if (requestIp) {
    const sentFromIpLastHour = await OtpChallenge.countDocuments({
      'metadata.requestIp': requestIp,
      createdAt: { $gte: oneHourAgo }
    });
    if (sentFromIpLastHour >= MAX_IP_SENDS_PER_HOUR) {
      throw Object.assign(new Error('Too many OTP requests from this network. Please try again later.'), {
        status: 429,
        code: 'OTP_IP_RATE_LIMITED'
      });
    }
  }

  const existing = await OtpChallenge.findOne({
    identifier,
    purpose: input.purpose,
    consumedAt: { $exists: false },
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (existing && Date.now() - new Date(existing.lastSentAt).getTime() < RESEND_COOLDOWN_MS) {
    throw Object.assign(new Error('Please wait 60 seconds before requesting another code'), {
      status: 429,
      code: 'OTP_RATE_LIMITED'
    });
  }

  const otp = generateOtp();
  await OtpChallenge.updateMany(
    { identifier, purpose: input.purpose, consumedAt: { $exists: false } },
    { $set: { consumedAt: new Date() } }
  );

  const challenge = await OtpChallenge.create({
    identifier,
    channel: getOtpChannel(input.purpose),
    purpose: input.purpose,
    otpHash: hashOtp(otp, identifier, input.purpose),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    retryCount: existing ? existing.retryCount + 1 : 0,
    lastSentAt: new Date(),
    metadata: input.metadata
  });

  const sentVia = challenge.channel === 'phone'
    ? await sendPhoneOtp(identifier, otp, input.purpose)
    : await sendEmailOtp(identifier, otp, input.purpose).then(() => 'email');

  return {
    challengeId: challenge._id.toString(),
    identifier,
    maskedIdentifier: maskIdentifier(identifier),
    purpose: input.purpose,
    expiresIn: Math.floor(OTP_TTL_MS / 1000),
    sentVia
  };
}

export async function verifyOtp(input: {
  identifier: string;
  purpose: OtpPurpose;
  otp: string;
}) {
  const identifier = normalizeOtpIdentifier(input.identifier, input.purpose);
  const otp = String(input.otp || '').trim();
  if (!identifier || !/^\d{6}$/.test(otp)) {
    throw Object.assign(new Error('Invalid verification code'), { status: 400, code: 'INVALID_OTP' });
  }

  const challenge = await OtpChallenge.findOne({
    identifier,
    purpose: input.purpose,
    consumedAt: { $exists: false },
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!challenge) {
    throw Object.assign(new Error('OTP not found or expired'), { status: 400, code: 'OTP_EXPIRED' });
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    challenge.consumedAt = new Date();
    await challenge.save();
    throw Object.assign(new Error('Maximum verification attempts exceeded'), { status: 429, code: 'OTP_ATTEMPTS_EXCEEDED' });
  }

  const expected = hashOtp(otp, identifier, input.purpose);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(challenge.otpHash, 'hex');
  const hashMatches = expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);

  if (!hashMatches) {
    challenge.attempts += 1;
    await challenge.save();
    throw Object.assign(new Error('Invalid verification code'), { status: 400, code: 'INVALID_OTP' });
  }

  challenge.consumedAt = new Date();
  await challenge.save();
  return challenge;
}
