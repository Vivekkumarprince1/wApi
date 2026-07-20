import crypto from 'crypto';
import { OtpChallenge } from '../models/index.js';
import { config } from '../config/index.js';
import { MailService } from './mail-service';

export type OtpPurpose = 'email_login' | 'email_verification' | 'signup_email';

const EMAIL_OTP_PURPOSES = new Set<OtpPurpose>(['email_login', 'email_verification', 'signup_email']);

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_IDENTIFIER_SENDS_PER_HOUR = 8;
const MAX_IP_SENDS_PER_HOUR = 20;

export function normalizeEmail(email?: string) {
  return String(email || '').trim().toLowerCase();
}

export function maskIdentifier(identifier: string) {
  const [name, domain] = identifier.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
}

export function normalizeOtpIdentifier(identifier: string, purpose: OtpPurpose): string {
  if (!EMAIL_OTP_PURPOSES.has(purpose)) {
    throw Object.assign(new Error('Only email OTP purposes are supported'), {
      status: 400,
      code: 'OTP_PURPOSE_UNSUPPORTED'
    });
  }
  return normalizeEmail(identifier);
}

export function hashOtp(otp: string, identifier: string, purpose: OtpPurpose): string {
  return crypto
    .createHmac('sha256', config.otpPepper)
    .update(`${purpose}:${identifier}:${otp}`)
    .digest('hex');
}

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

async function sendEmailOtp(identifier: string, otp: string, purpose: OtpPurpose) {
  const subject = purpose === 'signup_email' ? 'Verify your wApi account' : 'Your wApi verification code';
  const text = `Your verification code is ${otp}. It expires in 5 minutes.`;
  const result = await MailService.sendMail({
    to: identifier,
    subject,
    text
  });
  if (!result.success) {
    throw Object.assign(new Error(result.error || 'Email OTP delivery failed'), { status: 503, code: 'EMAIL_DELIVERY_FAILED' });
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

  // Dev-bypass: surface the OTP in the server console outside production so local
  // signup/login works even when email delivery is unavailable. Never in prod.
  if (config.env !== 'production') {
    console.log(`[OTP][dev][${input.purpose}] ${identifier}: ${otp}`);
  }

  await OtpChallenge.updateMany(
    { identifier, purpose: input.purpose, consumedAt: { $exists: false } },
    { $set: { consumedAt: new Date() } }
  );

  const challenge = await OtpChallenge.create({
    identifier,
    channel: 'email',
    purpose: input.purpose,
    otpHash: hashOtp(otp, identifier, input.purpose),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    retryCount: existing ? existing.retryCount + 1 : 0,
    lastSentAt: new Date(),
    metadata: input.metadata
  });

  try {
    await sendEmailOtp(identifier, otp, input.purpose);
  } catch (err: any) {
    console.error(`[OTP] Delivery failed for ${input.purpose} to ${identifier}: ${err.message}`);
    await challenge.deleteOne();
    throw Object.assign(
      new Error('We could not send the verification email. Please try again or contact support.'),
      { status: 503, code: 'OTP_DELIVERY_FAILED', originalError: err.message }
    );
  }

  return {
    challengeId: challenge._id.toString(),
    identifier,
    maskedIdentifier: maskIdentifier(identifier),
    purpose: input.purpose,
    expiresIn: Math.floor(OTP_TTL_MS / 1000),
    sentVia: 'email',
    ...(config.env !== 'production' ? { devOtp: otp } : {})
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
