import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import { Response, NextFunction } from 'express';
import { config } from '../config';
import { DeveloperOtpChallenge } from '../models';
import { ExternalApiRequest } from '../middleware/externalApiAuth';
import { WabaService } from '../services/external';
import { emitDeveloperEvent } from '../services/developer-webhook-service';

const DEFAULT_LANGUAGE = 'en_US';

function workspaceIdFrom(req: ExternalApiRequest) {
  return req.workspace?.id || req.workspace?._id;
}

function normalizePhone(raw: unknown) {
  return String(raw || '')
    .trim()
    .replace(/[\s().-]/g, '');
}

function isValidPhone(phone: string) {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

function normalizeString(raw: unknown, fallback = '') {
  return String(raw || fallback).trim();
}

function normalizePurpose(raw: unknown) {
  const value = normalizeString(raw, 'login').replace(/[^a-zA-Z0-9_.:-]/g, '_');
  return value.slice(0, 80) || 'login';
}

function clampNumber(raw: unknown, fallback: number, min: number, max: number) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function generateOtp(length: number) {
  const max = 10 ** length;
  const value = crypto.randomInt(0, max);
  return value.toString().padStart(length, '0');
}

function hashOtp(workspaceId: string, phone: string, purpose: string, otp: string) {
  return crypto
    .createHmac('sha256', config.internalServiceSecret)
    .update(`${workspaceId}:${phone}:${purpose}:${otp}`)
    .digest('hex');
}

function compareHash(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function findApprovedTemplate(workspaceId: string, templateName: string, languageCode?: string) {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database is not connected');

  const baseQuery = {
    workspaceId: String(workspaceId),
    name: templateName,
    status: 'APPROVED',
  };

  const collection = db.collection('bsp_template_mirrors');
  if (languageCode) {
    const exact = await collection.findOne({ ...baseQuery, language: languageCode });
    if (exact) return exact;
  }

  return collection.findOne(baseQuery);
}

function templateHasButton(template: any) {
  const providerData = template?.providerData || {};
  const buttons = providerData.buttons?.items || providerData.containerMeta?.buttons || [];
  if (Array.isArray(buttons) && buttons.length > 0) return true;

  const components = Array.isArray(providerData.components) ? providerData.components : [];
  return components.some((component: any) => String(component?.type || '').toUpperCase() === 'BUTTONS');
}

function textParameters(values: unknown[]) {
  return values
    .map((value) => normalizeString(value))
    .filter(Boolean)
    .map((text) => ({ type: 'text', text }));
}

function replaceOtpValue(value: unknown, otp: string) {
  const raw = normalizeString(value);
  if (!raw || raw === '{{otp}}' || raw === '$otp' || raw === 'OTP_CODE') return otp;
  return raw.replace(/\{\{otp\}\}|\$otp|OTP_CODE/g, otp);
}

function buildOtpComponents(bodyVariables: unknown, otp: string, includeOtpButton: boolean) {
  const bodyValues = Array.isArray(bodyVariables) && bodyVariables.length > 0
    ? bodyVariables.map((value) => replaceOtpValue(value, otp))
    : [otp];

  const components: any[] = [
    {
      type: 'body',
      parameters: textParameters(bodyValues),
    },
  ];

  if (includeOtpButton) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: otp }],
    });
  }

  return components;
}

function mediaParameter(format: string, url: string) {
  const type = format.toLowerCase();
  if (type === 'video') return { type: 'video', video: { link: url } };
  if (type === 'document') return { type: 'document', document: { link: url } };
  return { type: 'image', image: { link: url } };
}

function buildTemplateComponents(body: any, template: any) {
  if (Array.isArray(body.components)) return body.components;

  const components: any[] = [];
  const headerMediaUrl = normalizeString(body.headerMediaUrl);
  if (headerMediaUrl) {
    const header = (template?.providerData?.components || []).find(
      (component: any) => String(component?.type || '').toUpperCase() === 'HEADER'
    );
    const format = normalizeString(body.headerMediaType || header?.format, 'IMAGE').toUpperCase();
    components.push({
      type: 'header',
      parameters: [mediaParameter(format, headerMediaUrl)],
    });
  }

  const variables = Array.isArray(body.bodyVariables)
    ? body.bodyVariables
    : Array.isArray(body.variables)
      ? body.variables
      : [];

  if (variables.length > 0) {
    components.push({
      type: 'body',
      parameters: textParameters(variables),
    });
  }

  return components;
}

function publicSendResult(result: any) {
  return {
    providerAccepted: result?.success !== false,
    result,
  };
}

export const externalApiController = {
  async sendOtp(req: ExternalApiRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = workspaceIdFrom(req);
      if (!workspaceId) {
        return res.status(401).json({ success: false, message: 'Workspace could not be resolved from API key.' });
      }

      const phone = normalizePhone(req.body?.phone || req.body?.phoneNumber || req.body?.to);
      if (!isValidPhone(phone)) {
        return res.status(400).json({ success: false, message: 'phone must be in E.164 format, for example +919876543210.' });
      }

      const templateName = normalizeString(req.body?.templateName);
      if (!templateName) {
        return res.status(400).json({ success: false, message: 'templateName is required.' });
      }

      const languageCode = normalizeString(req.body?.languageCode, DEFAULT_LANGUAGE);
      const template = await findApprovedTemplate(workspaceId, templateName, languageCode);
      if (!template) {
        return res.status(400).json({
          success: false,
          message: 'Template not found or not APPROVED for this workspace.',
        });
      }

      const purpose = normalizePurpose(req.body?.purpose);
      const otpLength = clampNumber(req.body?.otpLength, 6, 4, 10);
      const ttlSeconds = clampNumber(req.body?.ttlSeconds, 300, 60, 1800);
      const maxAttempts = clampNumber(req.body?.maxAttempts, 5, 1, 10);
      const otp = generateOtp(otpLength);
      const includeOtpButton = req.body?.includeOtpButton === true || (req.body?.includeOtpButton !== false && templateHasButton(template));
      const components = buildOtpComponents(req.body?.bodyVariables || req.body?.variables, otp, includeOtpButton);

      const result = await WabaService.sendTemplateMessage(workspaceId, phone, templateName, languageCode, components, template.category);
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      await DeveloperOtpChallenge.updateMany(
        {
          workspaceId: new Types.ObjectId(workspaceId),
          phone,
          purpose,
          consumedAt: { $exists: false },
        },
        { $set: { consumedAt: new Date() } }
      );

      const challenge = await DeveloperOtpChallenge.create({
        workspaceId: new Types.ObjectId(workspaceId),
        phone,
        purpose,
        templateName,
        languageCode,
        otpHash: hashOtp(workspaceId, phone, purpose, otp),
        expiresAt,
        maxAttempts,
        metadata: req.body?.metadata || {},
      });

      void emitDeveloperEvent(workspaceId, 'auth.otp.sent', {
        challengeId: challenge._id.toString(),
        phone,
        purpose,
        templateName,
        languageCode,
        expiresAt,
      }).catch((err) => console.warn('[ExternalAPI] OTP webhook delivery failed:', err.message));

      res.status(202).json({
        success: true,
        data: {
          challengeId: challenge._id.toString(),
          phone,
          purpose,
          templateName,
          languageCode,
          expiresAt,
          ...publicSendResult(result),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async verifyOtp(req: ExternalApiRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = workspaceIdFrom(req);
      if (!workspaceId) {
        return res.status(401).json({ success: false, message: 'Workspace could not be resolved from API key.' });
      }

      const phone = normalizePhone(req.body?.phone || req.body?.phoneNumber || req.body?.to);
      const otp = normalizeString(req.body?.otp || req.body?.code);
      const purpose = normalizePurpose(req.body?.purpose);

      if (!isValidPhone(phone) || !otp) {
        return res.status(400).json({ success: false, message: 'phone and otp are required.' });
      }

      const challenge = await DeveloperOtpChallenge.findOne({
        workspaceId: new Types.ObjectId(workspaceId),
        phone,
        purpose,
        consumedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });

      if (!challenge) {
        void emitDeveloperEvent(workspaceId, 'auth.otp.failed', { phone, purpose, reason: 'not_found_or_expired' }).catch(() => {});
        return res.status(400).json({
          success: false,
          verified: false,
          message: 'OTP is expired or was not requested for this phone.',
        });
      }

      if (challenge.attempts >= challenge.maxAttempts) {
        void emitDeveloperEvent(workspaceId, 'auth.otp.failed', { phone, purpose, reason: 'max_attempts' }).catch(() => {});
        return res.status(429).json({
          success: false,
          verified: false,
          message: 'Too many OTP verification attempts.',
        });
      }

      challenge.attempts += 1;
      const expectedHash = hashOtp(workspaceId, phone, purpose, otp);
      const verified = compareHash(challenge.otpHash, expectedHash);

      if (!verified) {
        await challenge.save();
        void emitDeveloperEvent(workspaceId, 'auth.otp.failed', {
          challengeId: challenge._id.toString(),
          phone,
          purpose,
          reason: 'invalid_code',
        }).catch(() => {});
        return res.status(400).json({
          success: false,
          verified: false,
          attemptsRemaining: Math.max(0, challenge.maxAttempts - challenge.attempts),
          message: 'Invalid OTP.',
        });
      }

      challenge.consumedAt = new Date();
      await challenge.save();

      void emitDeveloperEvent(workspaceId, 'auth.otp.verified', {
        challengeId: challenge._id.toString(),
        phone,
        purpose,
      }).catch((err) => console.warn('[ExternalAPI] OTP verified webhook delivery failed:', err.message));

      res.json({
        success: true,
        verified: true,
        data: {
          challengeId: challenge._id.toString(),
          phone,
          purpose,
          verifiedAt: challenge.consumedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async sendTemplate(req: ExternalApiRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = workspaceIdFrom(req);
      if (!workspaceId) {
        return res.status(401).json({ success: false, message: 'Workspace could not be resolved from API key.' });
      }

      const phone = normalizePhone(req.body?.phone || req.body?.phoneNumber || req.body?.to);
      if (!isValidPhone(phone)) {
        return res.status(400).json({ success: false, message: 'phone must be in E.164 format, for example +919876543210.' });
      }

      const templateName = normalizeString(req.body?.templateName);
      if (!templateName) {
        return res.status(400).json({ success: false, message: 'templateName is required.' });
      }

      const languageCode = normalizeString(req.body?.languageCode, DEFAULT_LANGUAGE);
      const template = await findApprovedTemplate(workspaceId, templateName, languageCode);
      if (!template) {
        return res.status(400).json({
          success: false,
          message: 'Template not found or not APPROVED for this workspace.',
        });
      }

      const components = buildTemplateComponents(req.body || {}, template);
      const result = await WabaService.sendTemplateMessage(workspaceId, phone, templateName, languageCode, components, template.category);

      void emitDeveloperEvent(workspaceId, 'auth.template.sent', {
        phone,
        templateName,
        languageCode,
      }).catch((err) => console.warn('[ExternalAPI] Template webhook delivery failed:', err.message));

      void emitDeveloperEvent(workspaceId, 'template.sent', {
        phone,
        templateName,
        languageCode,
      }).catch(() => {});

      res.status(202).json({
        success: true,
        data: {
          phone,
          templateName,
          languageCode,
          components,
          ...publicSendResult(result),
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
