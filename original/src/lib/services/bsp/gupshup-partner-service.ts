import axios from 'axios';
import { config } from '@/lib/config';
import { resolveAppToken, resolvePartnerToken } from './gupshup-token-service';
import { connectRedis } from '@/lib/redis';

/**
 * Resolves a secure HTTPS URL for Gupshup V3 webhooks.
 * If the provided URL is localhost/http, it attempts to use the configured public tunnel.
 */
function resolveSecureWebhookUrl(inputUrl: string): string {
  if (inputUrl.startsWith('https://')) return inputUrl;

  // If we are on localhost, try to find a secure public tunnel
  const isLocal = inputUrl.includes('localhost') || inputUrl.includes('127.0.0.1');
  if (isLocal) {
    const publicBase = process.env.APP_URL || config.whatsappWebhookUrl;
    if (publicBase && publicBase.startsWith('https://')) {
      const urlObj = new URL(inputUrl);
      const publicObj = new URL(publicBase);
      // Construct the public version of the local path
      return `${publicObj.origin}${urlObj.pathname}${urlObj.search}`;
    }
  }

  return inputUrl;
}

function generateUniqueTag(appId: string, url: string) {
  // Simple deterministic hash from appId + URL to ensure unique but stable tags
  const combined = `${appId}:${url}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return `WAPI-V3-${Math.abs(hash).toString(36).toUpperCase()}`;
}

function normalizeToken(token?: string) {
  return String(token || '').replace(/^Bearer\s+/i, '').trim();
}

function partnerBaseUrl() {
  return config.gupshupPartnerBaseUrl.replace(/\/$/, '');
}

function authHeaders(token: string) {
  const raw = normalizeToken(token);
  return {
    token: raw,
    Authorization: raw, // V3 standard often requires this
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
}

function appAuthHeaders(token: string, contentType = 'application/json') {
  const raw = normalizeToken(token);
  return {
    Authorization: raw,
    Accept: 'application/json',
    'Content-Type': contentType
  };
}

async function withPartnerAuth<T>(fn: (token: string) => Promise<T>) {
  try {
    return await fn(await resolvePartnerToken());
  } catch (error: any) {
    const status = Number(error?.response?.status || 0);
    // Only force refresh on 401 (Unauthorized). For 403 (Forbidden), we handle it via dual-auth or let it bubble.
    if (status === 401) {
      return fn(await resolvePartnerToken(true));
    }
    throw error;
  }
}

async function checkPartnerIncompatibility(appId: string): Promise<boolean> {
   const redis = await connectRedis();
   if (!redis) return false;
   const val = await redis.get(`gupshup:partner-incompatible:${appId}`);
   return val === 'true';
}

async function markPartnerIncompatible(appId: string) {
   const redis = await connectRedis();
   if (!redis) return;
   await redis.set(`gupshup:partner-incompatible:${appId}`, 'true', 'EX', 3600); // 1 hour cool-down
}

async function withDualAuth<T>(appId: string, fn: (headers: any) => Promise<T>) {
  // Check if we already know this app isn't partner-managed
  const isIncompatible = await checkPartnerIncompatibility(appId);
  
  if (!isIncompatible) {
    try {
      // Stage 1: Try with Partner JWT (standard V3 Partner Auth)
      const token = await resolvePartnerToken();
      return await fn(authHeaders(token));
    } catch (error: any) {
      const status = Number(error?.response?.status || 0);
      if (status === 403) {
         console.warn(`[GupshupDualAuth] Partner JWT restricted (403) for ${appId}. Flagging for short-circuit.`);
         await markPartnerIncompatible(appId);
      } else if (status !== 401) {
         throw error;
      }
      // Fall through to App-level fallback
    }
  }

  console.log(`[GupshupDualAuth] Attempting App-level auth fallback for ${appId}...`);
  try {
    // Stage 2: Try with App API Key
    const appKey = await resolveAppToken(appId);
    return await fn(appAuthHeaders(appKey));
  } catch (fallbackError: any) {
    console.error(`[GupshupDualAuth] App-level fallback also failed for ${appId}`);
    throw fallbackError;
  }
}

// Strategy memory and locks have been removed in favor of direct Documentation-Standard V3 calls.

async function executeSubscriptionRequest(appId: string, baseUrlWithQuery: string, method: 'POST' | 'PUT' | 'DELETE' | 'GET', basePayload: any, headers: any) {
  const targetPath = baseUrlWithQuery;
  const targetUrl = basePayload.callbackUrl || basePayload.url || basePayload.webhookUrl;

  // Detect if this is a V3 request based on the version parameter in query or payload
  const isV3 = targetPath.includes('v=v3') || basePayload.version === '3';

  if (isV3 && method !== 'GET' && method !== 'DELETE') {
    const params = new URLSearchParams();
    params.append('url', targetUrl);
    params.append('version', '3');
    
    // Generate unique tag based on appId + URL if none provided
    const tag = basePayload.tag || generateUniqueTag(appId, targetUrl);
    params.append('tag', tag);
    
    // Gupshup V3 expects a comma-separated string of unique 'modes' (events)
    const rawEvents = Array.isArray(basePayload.events) ? basePayload.events : [];
    let modes = 'ALL';
    
    if (rawEvents.length > 0 && !rawEvents.includes('ALL')) {
      const uniqueModes = new Set<string>();
      
      rawEvents.forEach((e: any) => {
        const upper = String(e).toUpperCase().replace(/-EVENT/i, '').replace(/_/g, '_');
        
        // Internal/Legacy Mapping
        if (['USER', 'SYSTEM', 'MARKETING'].includes(upper)) {
          uniqueModes.add('OTHERS');
        } else if (['BILLING_EVENT', 'BILLING'].includes(upper)) {
          uniqueModes.add('BILLING');
        } else if (['ACCOUNT_EVENT', 'ACCOUNT'].includes(upper)) {
          uniqueModes.add('ACCOUNT');
        } else {
          // Pass through standard V3 modes:
          // MESSAGE, SENT, DELIVERED, READ, DELETED, FAILED, ENQUEUED, TEMPLATE, ACCOUNT, BILLING, FLOWS_MESSAGE, PAYMENTS, OTHERS
          uniqueModes.add(upper);
        }
      });
      
      modes = Array.from(uniqueModes).join(',');
    }
    params.append('modes', modes);
    params.append('showOnUI', 'true'); // Ensure visibility in Gupshup Partner Portal

    console.log(`[GupshupV3] Executing V3 ${method} to ${targetPath} with url [${targetUrl}] and modes [${modes}]...`);
    
    return await axios({
      url: targetPath,
      method,
      data: params.toString(),
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });
  }

  const finalPayload = {
    callbackUrl: targetUrl,
    events: Array.isArray(basePayload.events) ? basePayload.events : []
  };

  console.log(`[GupshupV3] Executing legacy ${method} to ${targetPath}...`);
  
  return await axios({
    url: targetPath,
    method,
    data: (method === 'GET' || method === 'DELETE') ? undefined : finalPayload,
    headers,
    timeout: 15000
  });
}

export interface PartnerApp {
  id: string;
  name?: string;
  live?: boolean;
  phone?: string | null;
  customerId?: string | null;
  accountMode?: string;
  mode?: string;
  healthy?: boolean;
  [key: string]: unknown;
}

export class GupshupPartnerService {
  static async getPartnerApps() {
    return withPartnerAuth(async (token) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/list`, {
        headers: authHeaders(token),
        timeout: 15000
      });
      const apps = response.data?.partnerAppsList || response.data?.data || response.data?.apps || [];
      return Array.isArray(apps) ? apps as PartnerApp[] : [];
    });
  }

  static async createPartnerApp(appName: string) {
    return withPartnerAuth(async (token) => {
      const body = new URLSearchParams();
      body.append('name', appName);
      body.append('templateMessaging', 'true');
      body.append('disableOptinPrefUrl', 'false');

      const response = await axios.post(`${partnerBaseUrl()}/partner/app`, body.toString(), {
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 20000
      });
      return {
        appId: response.data?.appId || response.data?.id || response.data?.data?.appId,
        appName: response.data?.name || appName,
        raw: response.data
      };
    });
  }

  static async getPartnerApp(appId: string) {
    return withPartnerAuth(async (token) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/details`, {
        headers: authHeaders(token),
        timeout: 15000
      });
      return response.data;
    });
  }

  static async getPartnerAppAccessToken(appId: string) {
    return resolveAppToken(appId);
  }

  static async updateOnboardingContact(input: {
    appId: string;
    contactName: string;
    contactEmail?: string;
    contactNumber?: string;
  }) {
    return withPartnerAuth(async (token) => {
      const body = new URLSearchParams();
      body.append('contactEmail', input.contactEmail || '');
      body.append('contactName', input.contactName);
      body.append('contactNumber', input.contactNumber || '0000000000');

      const response = await axios.put(`${partnerBaseUrl()}/partner/app/${input.appId}/onboarding/contact`, body.toString(), {
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
      });
      return response.data;
    });
  }

  static async getOnboardingEmbedLink(input: {
    appId: string;
    user?: string;
    lang?: string;
    regenerate?: boolean;
  }) {
    return withPartnerAuth(async (token) => {
      const query = new URLSearchParams();
      query.append('user', input.user || config.gupshupPartnerEmail || 'system');
      query.append('lang', input.lang || 'en');
      if (typeof input.regenerate === 'boolean') {
        query.append('regenerate', String(input.regenerate));
      }

      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${input.appId}/onboarding/embed/link?${query.toString()}`, {
        headers: {
          token: token,
          Accept: 'application/json'
        },
        timeout: 15000
      });
      return response.data;
    });
  }

  static async registerPhoneForApp(input: { appId: string; region?: string; phoneNumber?: string }) {
    return resolveAppToken(input.appId).then(async (token) => {
      const response = await axios.post(`${partnerBaseUrl()}/partner/app/${input.appId}/register/phone`, {
        phoneNumber: input.phoneNumber,
        region: input.region || config.gupshupDefaultRegion || 'IN'
      }, {
        headers: appAuthHeaders(token),
        timeout: 15000
      });
      return response.data;
    });
  }

  static async markAppForMigration(appId: string, migrationStatus: 'META_EMBED_MIGRATION' | 'MIGRATED_IN' = 'META_EMBED_MIGRATION') {
    return resolveAppToken(appId).then(async (token) => {
      const response = await axios.post(`${partnerBaseUrl()}/partner/app/${appId}/onboarding/phoneMigration`, null, {
        headers: appAuthHeaders(token),
        timeout: 15000
      });
      return response.data || { migrationStatus };
    });
  }

  static async listSubscriptions(appId: string) {
    return withDualAuth(appId, async (headers) => {
      // Append v=v3 to ensure we see all V3-bucketed subscriptions
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/subscription?v=v3`, {
        headers,
        timeout: 10000
      });
      // Instrumentation: Inspect the working GET response to identified mandatory fields and event names
      console.log(`[Instrumentation] Subscriptions for ${appId}:`);
      console.dir(response.data, { depth: null });
      
      const rawSubs = response.data?.subscriptions || response.data?.data || [];
      const normalized = Array.isArray(rawSubs) ? rawSubs.map((s: any) => ({
        ...s,
        events: s.modes || s.events || []
      })) : [];

      return normalized;
    });
  }

  static async setSubscription(input: { appId: string; url: string; events?: string[] }) {
    const secureUrl = resolveSecureWebhookUrl(input.url);
    
    if (!secureUrl.startsWith('https://')) {
      throw new Error(`Invalid webhook URL: "${secureUrl}". Gupshup V3 strictly requires an HTTPS callback URL. If you are on localhost, please configure a tunnel (ngrok) and set APP_URL.`);
    }

    return withDualAuth(input.appId, async (headers) => {
      // Normalize events: standard V3 passthrough often expects UPPERCASE
      const normalizedEvents = (input.events || ['MESSAGE', 'USER_EVENT', 'TEMPLATE_EVENT', 'BILLING_EVENT', 'MARKETING_EVENT'])
        .map(e => e === 'message-event' ? 'MESSAGE' : e.toUpperCase());

      const basePayload = {
        url: secureUrl, // Use the resolved secure URL
        events: normalizedEvents,
        version: '3'
      };

      // V3 Subscription often requires version in the query string
      const baseUrl = `${partnerBaseUrl()}/partner/app/${input.appId}/subscription`;
      const urlWithQuery = `${baseUrl}?v=v3`;

      const response = await executeSubscriptionRequest(input.appId, urlWithQuery, 'POST', basePayload, headers);
      return {
        ...response.data,
        registeredUrl: secureUrl,
        isTunneled: secureUrl !== input.url
      };
    });
  }

  static async getSubscriptionById(appId: string, subscriptionId: string) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/subscription/${subscriptionId}`, {
        headers,
        timeout: 10000
      });
      return response.data?.subscription || response.data?.data || null;
    });
  }

  static async updateSubscription(input: { appId: string; subscriptionId: string; url: string; events: string[]; tag?: string }) {
    return withDualAuth(input.appId, async (headers) => {
      const normalizedEvents = input.events.map(e => e.toUpperCase().replace('-EVENT', ''));

      const secureUrl = resolveSecureWebhookUrl(input.url);
      if (!secureUrl.startsWith('https://')) {
        throw new Error(`HTTPS required for V3 updates. URL: ${secureUrl}`);
      }

      const basePayload: any = {
        url: secureUrl,
        events: normalizedEvents,
        version: '3'
      };

      if (input.tag) {
        basePayload.tag = input.tag;
      }
      
      const baseUrl = `${partnerBaseUrl()}/partner/app/${input.appId}/subscription/${input.subscriptionId}`;
      const urlWithQuery = `${baseUrl}?v=v3`;

      const response = await executeSubscriptionRequest(input.appId, urlWithQuery, 'PUT', basePayload, headers);
      return {
        ...response.data,
        registeredUrl: secureUrl,
        isTunneled: secureUrl !== input.url
      };
    });
  }

  static async deleteSubscription(appId: string, subscriptionId?: string) {
    return withDualAuth(appId, async (headers) => {
      const url = subscriptionId 
        ? `${partnerBaseUrl()}/partner/app/${appId}/subscription/${subscriptionId}`
        : `${partnerBaseUrl()}/partner/app/${appId}/subscription`;
      
      const response = await axios.delete(url, {
        headers,
        timeout: 10000
      });
      return response.data;
    });
  }

  static async getWabaInfo(appId: string) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/wabaInfo`, {
        headers,
        timeout: 15000
      });
      return response.data;
    });
  }

  
  static async getBusinessProfile(appId: string) {
    return resolveAppToken(appId).then(async (token) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/business/profile`, {
        headers: appAuthHeaders(token),
        timeout: 15000
      });
      return response.data;
    });
  }

  static async getProfileDisplayName(appId: string) {
    return resolveAppToken(appId).then(async (token) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/profile/displayName`, {
        headers: {
          ...appAuthHeaders(token),
          Accept: 'application/json'
        },
        timeout: 15000
      });
      return response.data;
    });
  }

  static async updateProfileDisplayName(appId: string, newDisplayName: string) {
    return resolveAppToken(appId).then(async (token) => {
      const body = new URLSearchParams();
      body.append('newDisplayName', String(newDisplayName || '').trim());

      const response = await axios.post(
        `${partnerBaseUrl()}/partner/app/${appId}/profile/displayName`,
        body.toString(),
        {
          headers: {
            ...appAuthHeaders(token, 'application/x-www-form-urlencoded'),
            Accept: 'application/json'
          },
          timeout: 15000
        }
      );

      return response.data;
    });
  }


  
  static async updateBusinessProfile(appId: string, profile: any) {
    return resolveAppToken(appId).then(async (token) => {
      // Sanitize fields: Gupshup/Meta requires non-empty address and description for most tiers
      const sanitizedPayload = {
        ...profile,
        address: profile.address || 'Not Available',
        description: profile.description || 'WhatsApp Business Account',
        websites: Array.isArray(profile.websites) ? profile.websites.filter(Boolean) : profile.websites
      };

      // The profile API Reference and error logs show Allow: PUT, GET. 
      // We will use PUT as primary and retry with POST only if PUT fails (to handle legacy endpoints).
      try {
        const response = await axios.put(`${partnerBaseUrl()}/partner/app/${appId}/business/profile`, sanitizedPayload, {
          headers: appAuthHeaders(token),
          timeout: 15000
        });
        return response.data;
      } catch (error: any) {
        const status = error.response?.status;
        if (status === 405 || status === 400) {
           console.log(`[GupshupProfile] PUT failed with ${status}. Falling back to POST...`);
           const response = await axios.post(`${partnerBaseUrl()}/partner/app/${appId}/business/profile`, sanitizedPayload, {
             headers: appAuthHeaders(token),
             timeout: 15000
           });
           return response.data;
        }
        throw error;
      }
    });
  }

  /**
   * Whitelist WABA for OBO flow
   * POST /partner/app/{appId}/oboToEmbed/whitelist
   */
  static async whitelistWaba(appId: string, wabaId: string) {
    return withPartnerAuth(async (token) => {
      const response = await axios.post(`${partnerBaseUrl()}/partner/app/${appId}/oboToEmbed/whitelist`, { wabaId }, {
        headers: authHeaders(token),
        timeout: 15000
      });
      return response.data;
    });
  }

  /**
   * Verify Credit Line for OBO flow
   * GET /partner/app/{appId}/oboToEmbed/verify
   */
  static async verifyCreditLine(appId: string) {
    return withPartnerAuth(async (token) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/oboToEmbed/verify`, {
        headers: authHeaders(token),
        timeout: 15000
      });
      return response.data;
    });
  }

  /**
   * Get app health status
   * GET /partner/app/{appId}/health
   */
  static async getHealth(appId: string) {
    return withPartnerAuth(async (token) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/health`, {
        headers: authHeaders(token),
        timeout: 15000
      });
      return response.data;
    });
  }

  /**
   * Get app wallet balance
   * GET /partner/app/{appId}/wallet/balance
   */
  static async getWalletBalance(appId: string) {
    return withPartnerAuth(async (token) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/wallet/balance`, {
        headers: authHeaders(token),
        timeout: 15000
      });
      return response.data;
    });
  }

  /**
   * Get app ratings
   * GET /partner/app/{appId}/ratings
   */
  static async getRatings(appId: string) {
    return withPartnerAuth(async (token) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/ratings`, {
        headers: authHeaders(token),
        timeout: 15000
      });
      return response.data;
    });
  }

  /**
   * Get templates from Meta Library
   * GET /partner/app/{appId}/template/metalibrary
   */
  static async getMetaLibraryTemplates(appId: string, vertical?: string) {
    return withDualAuth(appId, async (headers) => {
      const query = new URLSearchParams();
      query.append('v', 'v3');
      if (vertical) query.append('vertical', vertical);

      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/template/metalibrary?${query.toString()}`, {
        headers,
        timeout: 15000
      });
      return response.data?.templates || response.data?.data || [];
    });
  }

  /**
   * Create template from Meta Library
   * POST /partner/app/{appId}/template/metalibrary
   */
  static async cloneMetaLibraryTemplate(appId: string, payload: {
    elementName: string;
    languageCode: string;
    category: string;
    components: any[];
  }) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.post(`${partnerBaseUrl()}/partner/app/${appId}/template/metalibrary?v=v3`, payload, {
        headers,
        timeout: 15000
      });
      return response.data;
    });
  }



  // ═══════════════════════════════════════════════════════════════════════════════
  // FLOW MANAGEMENT APIS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create a new Flow
   * POST /partner/app/{appId}/flow
   */
  static async createFlow(appId: string, name: string, categories: string[]) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.post(`${partnerBaseUrl()}/partner/app/${appId}/flow`, {
        name,
        categories
      }, { headers, timeout: 15000 });
      return response.data;
    });
  }

  /**
   * Get all Flows
   * GET /partner/app/{appId}/flow
   */
  static async getFlows(appId: string) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/flow`, {
        headers, timeout: 15000
      });
      return response.data;
    });
  }

  /**
   * Get Flow by ID
   * GET /partner/app/{appId}/flow/{flowId}
   */
  static async getFlowById(appId: string, flowId: string) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/flow/${flowId}`, {
        headers, timeout: 15000
      });
      return response.data;
    });
  }

  /**
   * Update Flow Categories
   * PUT /partner/app/{appId}/flow/{flowId}
   */
  static async updateFlow(appId: string, flowId: string, categories: string[]) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.put(`${partnerBaseUrl()}/partner/app/${appId}/flow/${flowId}`, {
        categories
      }, { headers, timeout: 15000 });
      return response.data;
    });
  }

  /**
   * Get Flow JSON
   * GET /partner/app/{appId}/flow/{flowId}/json
   */
  static async getFlowJson(appId: string, flowId: string) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/flow/${flowId}/json`, {
        headers, timeout: 15000
      });
      return response.data;
    });
  }

  /**
   * Update Flow JSON
   * PUT /partner/app/{appId}/flow/{flowId}/json
   */
  static async updateFlowJson(appId: string, flowId: string, name: string, json: any) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.put(`${partnerBaseUrl()}/partner/app/${appId}/flow/${flowId}/json`, {
        name,
        flow_json: json
      }, { headers, timeout: 15000 });
      return response.data;
    });
  }

  /**
   * Get Flow Preview URL
   * GET /partner/app/{appId}/flow/{flowId}/preview
   */
  static async getFlowPreviewUrl(appId: string, flowId: string) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.get(`${partnerBaseUrl()}/partner/app/${appId}/flow/${flowId}/preview`, {
        headers, timeout: 15000
      });
      return response.data;
    });
  }

  /**
   * Publish Flow
   * POST /partner/app/{appId}/flow/{flowId}/publish
   */
  static async publishFlow(appId: string, flowId: string) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.post(`${partnerBaseUrl()}/partner/app/${appId}/flow/${flowId}/publish`, {}, {
        headers, timeout: 15000
      });
      return response.data;
    });
  }

  /**
   * Deprecate Flow
   * POST /partner/app/{appId}/flow/{flowId}/deprecate
   */
  static async deprecateFlow(appId: string, flowId: string) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.post(`${partnerBaseUrl()}/partner/app/${appId}/flow/${flowId}/deprecate`, {}, {
        headers, timeout: 15000
      });
      return response.data;
    });
  }

  /**
   * Delete Flow
   * DELETE /partner/app/{appId}/flow/{flowId}
   */
  static async deleteFlow(appId: string, flowId: string) {
    return withDualAuth(appId, async (headers) => {
      const response = await axios.delete(`${partnerBaseUrl()}/partner/app/${appId}/flow/${flowId}`, {
        headers, timeout: 15000
      });
      return response.data;
    });
  }
}
