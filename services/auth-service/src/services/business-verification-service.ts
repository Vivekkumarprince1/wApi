import crypto from 'crypto';
import axios from 'axios';

export interface BusinessVerificationInput {
  gstNumber?: string;
  panNumber?: string;
  msmeNumber?: string;
  businessName?: string;
}

export interface BusinessVerificationResult {
  provider: 'mock' | 'cleartax' | 'karza';
  legalName: string;
  registryStatus: 'active' | 'inactive' | 'unknown';
  raw: Record<string, unknown>;
}

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MSME_PATTERN = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;

type VerificationDocumentType = 'gst' | 'pan' | 'msme';

type VerificationOutcome = {
  provider: 'mock' | 'cleartax' | 'karza';
  documentType: VerificationDocumentType;
  legalName: string;
  registryStatus: 'active' | 'inactive' | 'unknown';
  raw: Record<string, unknown>;
};

function normalizeName(value = '') {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\b(PRIVATE|PVT|LIMITED|LTD|LLP|OPC|THE|AND)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function scoreBusinessNameMatch(inputName = '', legalName = '') {
  const inputTokens = new Set(normalizeName(inputName).split(' ').filter(Boolean));
  const legalTokens = new Set(normalizeName(legalName).split(' ').filter(Boolean));
  if (!inputTokens.size || !legalTokens.size) return 0;

  let matches = 0;
  for (const token of inputTokens) {
    if (legalTokens.has(token)) matches += 1;
  }
  return Math.round((matches / Math.max(inputTokens.size, legalTokens.size)) * 100);
}

function deriveMockLegalName(input: BusinessVerificationInput) {
  const base = normalizeName(input.businessName || 'Verified Business');
  const suffix = crypto
    .createHash('sha1')
    .update(`${input.gstNumber || ''}:${input.msmeNumber || ''}:${base}`)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase();
  return `${base || 'VERIFIED BUSINESS'} ${suffix} PRIVATE LIMITED`;
}

function normalizeRegistryStatus(status: unknown): 'active' | 'inactive' | 'unknown' {
  const value = String(status || '').toLowerCase();
  if (!value) return 'unknown';
  if (['active', 'enabled', 'approved', 'valid'].includes(value)) return 'active';
  if (['inactive', 'cancelled', 'suspended', 'invalid', 'revoked', 'blocked'].includes(value)) return 'inactive';
  return 'unknown';
}

function getVerificationMode() {
  return String(process.env.BUSINESS_VERIFICATION_PROVIDER || 'hybrid').toLowerCase();
}

function allowMockFallback() {
  const mode = getVerificationMode();
  return mode === 'mock' || (mode === 'hybrid' && process.env.NODE_ENV !== 'production' && !process.env.CLEARTAX_API_KEY && !process.env.KARZA_API_KEY);
}

function buildMockVerificationOutcome(input: BusinessVerificationInput, documentType: VerificationDocumentType): VerificationOutcome {
  return {
    provider: 'mock',
    documentType,
    legalName: deriveMockLegalName(input),
    registryStatus: 'active',
    raw: {
      provider: 'mock',
      documentType,
      gstNumber: input.gstNumber || undefined,
      panNumber: input.panNumber || undefined,
      msmeNumber: input.msmeNumber || undefined,
      fetchedAt: new Date().toISOString()
    }
  };
}

function isProductionVerificationMode() {
  return process.env.NODE_ENV === 'production' && getVerificationMode() !== 'mock';
}

async function requestWithRetry<T>(requestFn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      const status = Number(error?.response?.status || 0);
      const retryable = status === 429 || status >= 500 || status === 0;
      if (!retryable || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw lastError;
}

async function verifyWithCleartax(input: BusinessVerificationInput): Promise<VerificationOutcome> {
  const cleartaxApiKey = process.env.CLEARTAX_API_KEY;
  const cleartaxBaseUrl = process.env.CLEARTAX_BASE_URL || 'https://api.cleartax.in';

  if (!cleartaxApiKey) {
    throw Object.assign(new Error('ClearTax API key is not configured'), { status: 503, code: 'CLEARTAX_NOT_CONFIGURED' });
  }

  const gstNumber = String(input.gstNumber || '').trim().toUpperCase();
  const msmeNumber = String(input.msmeNumber || '').trim().toUpperCase();

  const response = await requestWithRetry(async () => {
    if (gstNumber) {
      return axios.get(`${cleartaxBaseUrl.replace(/\/$/, '')}/gst/v1/taxpayer/${gstNumber}`, {
        headers: {
          'x-api-key': cleartaxApiKey,
          Accept: 'application/json'
        },
        timeout: 15000
      });
    }

    return axios.get(`${cleartaxBaseUrl.replace(/\/$/, '')}/msme/v1/udyam/${msmeNumber}`, {
      headers: {
        'x-api-key': cleartaxApiKey,
        Accept: 'application/json'
      },
      timeout: 15000
    });
  });

  const payload = response.data || {};
  const legalName = payload.legalName || payload.tradeName || payload.businessName || payload.entityName;
  const status = normalizeRegistryStatus(payload.status || payload.gstStatus || payload.registrationStatus);

  if (!legalName) {
    throw Object.assign(new Error('ClearTax response missing legal name'), { status: 502, code: 'CLEARTAX_INVALID_RESPONSE' });
  }

  return {
    provider: 'cleartax',
    documentType: 'gst',
    legalName,
    registryStatus: status,
    raw: payload
  };
}

async function verifyKarzaDocument(documentType: 'pan' | 'msme', documentNumber: string, businessName?: string): Promise<VerificationOutcome> {
  const karzaApiKey = process.env.KARZA_API_KEY;
  const baseUrl = (process.env.KARZA_BASE_URL || 'https://api.karza.in').replace(/\/$/, '');
  const endpointPath = documentType === 'pan' 
    ? (process.env.KARZA_PAN_VERIFY_PATH || '/v3/pan-profile') 
    : (process.env.KARZA_MSME_VERIFY_PATH || '/v3/msme-verify');
  const endpointUrl = `${baseUrl}${endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`}`;

  if (!karzaApiKey) {
    throw Object.assign(new Error('Karza API key is not configured'), { status: 503, code: 'KARZA_NOT_CONFIGURED' });
  }

  const response = await requestWithRetry(async () => {
    if (documentType === 'pan') {
      return axios.post(endpointUrl, { pan: documentNumber, panNumber: documentNumber, businessName }, {
        headers: {
          'x-api-key': karzaApiKey,
          Accept: 'application/json'
        },
        timeout: 15000
      });
    }

    return axios.post(endpointUrl, { udyamNumber: documentNumber, msmeNumber: documentNumber, businessName }, {
      headers: {
        'x-api-key': karzaApiKey,
        Accept: 'application/json'
      },
      timeout: 15000
    });
  });

  const payload = response.data || {};
  const result = payload.result || payload.data || payload;
  const legalName = result.legalName || result.businessName || result.tradeName || result.name;
  const status = normalizeRegistryStatus(result.status || result.registrationStatus || result.gstStatus || result.verificationStatus);

  if (!legalName) {
    throw Object.assign(new Error(`Karza ${documentType.toUpperCase()} response missing legal name`), { status: 502, code: 'KARZA_INVALID_RESPONSE' });
  }

  return {
    provider: 'karza',
    documentType,
    legalName,
    registryStatus: status,
    raw: payload
  };
}

async function verifyWithKarza(input: BusinessVerificationInput): Promise<VerificationOutcome> {
  const panNumber = String(input.panNumber || '').trim().toUpperCase();
  const msmeNumber = String(input.msmeNumber || '').trim().toUpperCase();
  const documentResults: VerificationOutcome[] = [];

  if (panNumber) {
    documentResults.push(await verifyKarzaDocument('pan', panNumber, input.businessName));
  }

  if (msmeNumber) {
    documentResults.push(await verifyKarzaDocument('msme', msmeNumber, input.businessName));
  }

  if (!documentResults.length) {
    throw Object.assign(new Error('PAN or MSME number is required for Karza verification'), { status: 400, code: 'DOCUMENT_REQUIRED' });
  }

  const primary = documentResults.find((entry) => entry.documentType === 'pan') || documentResults[0];
  const registryStatus = documentResults.some((entry) => entry.registryStatus === 'inactive')
    ? 'inactive'
    : documentResults.every((entry) => entry.registryStatus === 'active')
      ? 'active'
      : 'unknown';

  return {
    provider: 'karza',
    documentType: primary.documentType,
    legalName: primary.legalName,
    registryStatus,
    raw: {
      provider: 'karza',
      primaryDocumentType: primary.documentType,
      documents: documentResults,
      businessName: input.businessName || null
    }
  };
}

export async function verifyBusinessDocument(input: BusinessVerificationInput): Promise<BusinessVerificationResult> {
  const gstNumber = String(input.gstNumber || '').trim().toUpperCase();
  const panNumber = String(input.panNumber || '').trim().toUpperCase();
  const msmeNumber = String(input.msmeNumber || '').trim().toUpperCase();

  if (!gstNumber && !panNumber && !msmeNumber) {
    throw Object.assign(new Error('GST, PAN, or MSME number is required'), { status: 400, code: 'DOCUMENT_REQUIRED' });
  }
  if (gstNumber && !GSTIN_PATTERN.test(gstNumber)) {
    throw Object.assign(new Error('Invalid GST number format'), { status: 400, code: 'INVALID_GST' });
  }
  if (panNumber && !PAN_PATTERN.test(panNumber)) {
    throw Object.assign(new Error('Invalid PAN number format'), { status: 400, code: 'INVALID_PAN' });
  }
  if (msmeNumber && !MSME_PATTERN.test(msmeNumber)) {
    throw Object.assign(new Error('Invalid MSME number format'), { status: 400, code: 'INVALID_MSME' });
  }

  if (getVerificationMode() === 'mock') {
    const primaryDocumentType: VerificationDocumentType = gstNumber ? 'gst' : panNumber ? 'pan' : 'msme';
    return buildMockVerificationOutcome({ ...input, gstNumber, panNumber, msmeNumber }, primaryDocumentType);
  }

  try {
    if (gstNumber) {
      const result = await verifyWithCleartax({ ...input, gstNumber, panNumber, msmeNumber });
      return {
        provider: result.provider,
        legalName: result.legalName,
        registryStatus: result.registryStatus,
        raw: {
          provider: result.provider,
          documentType: result.documentType,
          result,
          businessName: input.businessName || null,
          documents: {
            gstNumber,
            panNumber: panNumber || undefined,
            msmeNumber: msmeNumber || undefined,
          }
        }
      };
    }

    if (panNumber || msmeNumber) {
      const result = await verifyWithKarza({ ...input, gstNumber, panNumber, msmeNumber });
      return {
        provider: result.provider,
        legalName: result.legalName,
        registryStatus: result.registryStatus,
        raw: {
          provider: result.provider,
          documentType: result.documentType,
          result,
          businessName: input.businessName || null,
          documents: {
            gstNumber: gstNumber || undefined,
            panNumber: panNumber || undefined,
            msmeNumber: msmeNumber || undefined,
          }
        }
      };
    }

    throw Object.assign(new Error('GST, PAN, or MSME number is required'), { status: 400, code: 'DOCUMENT_REQUIRED' });
  } catch (error: any) {
    if (isProductionVerificationMode()) {
      throw Object.assign(new Error(error.message || 'Business verification provider failed'), {
        status: error.status || error.response?.status || 502,
        code: error.code || 'BUSINESS_VERIFICATION_FAILED'
      });
    }

    if (allowMockFallback()) {
      const primaryDocumentType: VerificationDocumentType = gstNumber ? 'gst' : panNumber ? 'pan' : 'msme';
      return buildMockVerificationOutcome({ ...input, gstNumber, panNumber, msmeNumber }, primaryDocumentType);
    }

    throw error;
  }
}
