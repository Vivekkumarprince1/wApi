import axios, { AxiosRequestConfig } from 'axios';
import { Integration } from '../../models';
import { AutomationService } from '../automation-service';
import { contactInternalClient } from '../../lib/internal-client';

type PetpoojaCredentials = {
  appKey?: string;
  appSecret?: string;
  accessToken?: string;
  restId?: string;
  vendorId?: string;
  apiKey?: string;
  baseUrl?: string;
};

const DEFAULT_BASE_URL = 'https://developerapi.petpooja.com/v2';

function formatDate(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function normalizeCredentials(raw: PetpoojaCredentials) {
  return {
    appKey: raw.appKey?.trim(),
    appSecret: raw.appSecret?.trim(),
    accessToken: raw.accessToken?.trim(),
    restId: raw.restId?.trim(),
    vendorId: raw.vendorId?.trim(),
    apiKey: raw.apiKey?.trim(),
    baseUrl: raw.baseUrl?.trim() || process.env.PETPOOJA_BASE_URL || DEFAULT_BASE_URL,
  };
}

function hasOfficialCredentials(credentials: ReturnType<typeof normalizeCredentials>) {
  return Boolean(credentials.appKey && credentials.appSecret && credentials.accessToken && credentials.restId);
}

function hasLegacyCredentials(credentials: ReturnType<typeof normalizeCredentials>) {
  return Boolean(credentials.vendorId && credentials.apiKey);
}

function buildOfficialPayload(credentials: ReturnType<typeof normalizeCredentials>, extra: Record<string, any> = {}) {
  return {
    app_key: credentials.appKey,
    app_secret: credentials.appSecret,
    access_token: credentials.accessToken,
    restID: credentials.restId,
    ...extra,
  };
}

function getOrderPhone(order: any) {
  return (
    order?.customer_phone ||
    order?.customer_mobile ||
    order?.customer?.phone ||
    order?.customer?.mobile ||
    order?.phone ||
    order?.mobile ||
    ''
  );
}

function getOrderName(order: any) {
  return (
    order?.customer_name ||
    order?.customer?.name ||
    order?.name ||
    getOrderPhone(order)
  );
}

function extractOrders(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.data?.orders)) return payload.data.orders;
  if (Array.isArray(payload?.orderdetails)) return payload.orderdetails;
  if (Array.isArray(payload?.data?.orderdetails)) return payload.data.orderdetails;
  if (Array.isArray(payload?.order_details)) return payload.order_details;
  return [];
}

async function firstSuccessfulRequest(candidates: AxiosRequestConfig[]) {
  let lastError: any;
  for (const candidate of candidates) {
    try {
      return await axios.request({ timeout: 20_000, ...candidate });
    } catch (err: any) {
      lastError = err;
    }
  }
  throw lastError;
}

async function resolveOrderContact(workspaceId: string, order: any) {
  const phone = getOrderPhone(order);
  if (!phone) return null;

  const response = await contactInternalClient.post('/internal/v1/contacts/resolve', {
    workspaceId,
    phone,
    name: getOrderName(order),
  }, {
    headers: { 'x-workspace-id': workspaceId }
  });

  return response.data?.data || response.data;
}

export class PetpoojaService {
  static normalizeCredentials(raw: PetpoojaCredentials) {
    const credentials = normalizeCredentials(raw);
    if (!hasOfficialCredentials(credentials) && !hasLegacyCredentials(credentials)) {
      throw new Error('Petpooja credentials are incomplete.');
    }
    return credentials;
  }

  /**
   * Fetch recent orders for a workspace's Petpooja integration.
   */
  static async syncOrders(workspaceId: string) {
    const integration = await (Integration as any).findOne({
      workspace: workspaceId,
      type: 'petpooja',
      status: 'connected'
    }).select('+config');

    if (!integration) return { processed: 0 };

    const credentials = normalizeCredentials(integration.getDecryptedConfig?.() || {});
    const fromDate = integration.lastSyncAt
      ? formatDate(integration.lastSyncAt)
      : formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const toDate = formatDate(new Date());

    try {
      const candidates: AxiosRequestConfig[] = [];

      if (hasOfficialCredentials(credentials)) {
        const payload = buildOfficialPayload(credentials, {
          from_date: fromDate,
          to_date: toDate,
        });
        candidates.push(
          { method: 'POST', url: `${credentials.baseUrl}/get_order_details`, data: payload },
          { method: 'POST', url: `${credentials.baseUrl}/orders`, data: payload },
        );
      }

      if (hasLegacyCredentials(credentials)) {
        candidates.push({
          method: 'GET',
          url: `${credentials.baseUrl}/orders`,
          headers: {
            'api-key': credentials.apiKey,
            'vendor-id': credentials.vendorId,
          },
          params: { from_date: fromDate, to_date: toDate },
        });
      }

      const response = await firstSuccessfulRequest(candidates);
      const orders = extractOrders(response.data);
      let processed = 0;

      for (const order of orders) {
        const contact = await resolveOrderContact(workspaceId, order);
        await AutomationService.trigger(workspaceId, 'petpooja.order.created', {
          order,
          contact,
          contactId: contact?._id || contact?.id,
          phone: getOrderPhone(order),
          source: 'petpooja',
        });
        processed += 1;
      }

      integration.configMetadata = {
        ...(integration.configMetadata || {}),
        lastSyncProcessedCount: processed,
        lastSyncOrderCount: orders.length,
        lastSyncAt: new Date(),
      };
      await integration.markSynced(processed);

      return { processed, totalOrders: orders.length };
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Petpooja sync failed';
      await integration.markError(message, 'SYNC_FAILED');
      throw new Error(message);
    }
  }

  /**
   * Validate credentials during onboarding. Some Petpooja accounts only expose
   * order endpoints after marketplace approval, so strict live validation is
   * opt-in via PETPOOJA_VALIDATE_ON_CONNECT=true.
   */
  static async validateCredentials(rawCredentials: PetpoojaCredentials) {
    const credentials = this.normalizeCredentials(rawCredentials);
    if (process.env.PETPOOJA_VALIDATE_ON_CONNECT !== 'true') return true;

    const candidates: AxiosRequestConfig[] = [];

    if (hasOfficialCredentials(credentials)) {
      const payload = buildOfficialPayload(credentials);
      candidates.push(
        { method: 'POST', url: `${credentials.baseUrl}/get_restaurant_info`, data: payload },
        { method: 'POST', url: `${credentials.baseUrl}/restaurants`, data: payload },
      );
    }

    if (hasLegacyCredentials(credentials)) {
      candidates.push({
        method: 'GET',
        url: `${credentials.baseUrl}/restaurants`,
        headers: {
          'api-key': credentials.apiKey,
          'vendor-id': credentials.vendorId,
        },
      });
    }

    try {
      await firstSuccessfulRequest(candidates);
      return true;
    } catch {
      return false;
    }
  }
}
