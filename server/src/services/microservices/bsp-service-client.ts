import axios, { AxiosRequestConfig } from 'axios';
import { config } from '@/config';
import { getCorrelationId } from '@/utils/logger';

type RequestOptions = {
  workspaceId?: string;
  userId?: string;
  method?: AxiosRequestConfig['method'];
  path: string;
  data?: unknown;
  params?: unknown;
  timeout?: number;
};

function correlationId() {
  return getCorrelationId() || `corr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function headers(workspaceId?: string, userId?: string) {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-internal-service': 'main-service',
    'x-internal-secret': config.internalServiceSecret,
    'x-internal-service-secret': config.internalServiceSecret,
    'x-correlation-id': correlationId(),
  };
  if (workspaceId) h['x-workspace-id'] = workspaceId;
  if (userId) h['x-user-id'] = userId;
  return h;
}

export function normalizePhoneNumber(phone: string, defaultCountryCode = '91') {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = `${defaultCountryCode}${cleaned}`;
  return cleaned;
}

export class BspServiceClient {
  static async request<T = any>(options: RequestOptions): Promise<T> {
    const baseUrl = config.bspServiceUrl.replace(/\/$/, '');
    const response = await axios({
      method: options.method || 'GET',
      url: `${baseUrl}${options.path}`,
      data: options.data,
      params: options.params,
      headers: headers(options.workspaceId, options.userId),
      timeout: options.timeout || 15000,
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      const message = response.data?.message || response.data?.error || `BSP_SERVICE_${response.status}`;
      throw Object.assign(new Error(message), { status: response.status, data: response.data });
    }

    return response.data?.data ?? response.data;
  }

  static async sendMessage(input: {
    workspaceId: string;
    appId: string;
    to: string;
    type: string;
    sourcePhone?: string;
    conversationId?: string;
    contactId?: string;
    campaignId?: string;
    idempotencyKey?: string;
    payload: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    return this.request({
      method: 'POST',
      path: '/internal/v1/bsp/messages/send',
      workspaceId: input.workspaceId,
      data: {
        ...input,
        provider: 'gupshup',
      },
      timeout: 30000,
    });
  }

  static async templateSync(workspaceId: string, appId: string, force = false) {
    return this.request({
      method: 'POST',
      path: '/internal/v1/bsp/templates/sync',
      workspaceId,
      data: { workspaceId, provider: 'gupshup', appId, force },
      timeout: 30000,
    });
  }

  static async submitTemplate(workspaceId: string, providerTemplateId: string, payload: Record<string, unknown>) {
    return this.request({
      method: 'POST',
      path: `/internal/v1/bsp/templates/${encodeURIComponent(providerTemplateId)}/submit`,
      workspaceId,
      data: payload,
      timeout: 30000,
    });
  }

  static async providerAction<T = any>(input: {
    workspaceId?: string;
    appId?: string;
    action: string;
    payload?: Record<string, unknown>;
  }): Promise<T> {
    return this.request<T>({
      method: 'POST',
      path: '/internal/v1/bsp/provider/actions',
      workspaceId: input.workspaceId,
      data: {
        provider: 'gupshup',
        appId: input.appId,
        action: input.action,
        payload: input.payload || {},
      },
      timeout: 30000,
    });
  }

  static async getAppForWorkspace(workspaceId: string) {
    return this.request({
      method: 'GET',
      path: `/internal/v1/bsp/apps/${workspaceId}/workspace`,
      workspaceId,
      timeout: 10000,
    });
  }

  static async syncAppWhatsappData(appId: string, data: Record<string, unknown>) {
    return this.request({
      method: 'POST',
      path: `/internal/v1/bsp/apps/${appId}/sync-whatsapp`,
      data,
      timeout: 10000,
    });
  }

  static async syncAppGupshupData(appId: string, data: Record<string, unknown>) {
    return this.request({
      method: 'POST',
      path: `/internal/v1/bsp/apps/${appId}/sync-gupshup`,
      data,
      timeout: 10000,
    });
  }

  static async syncAppPhoneData(appId: string, data: Record<string, unknown>) {
    return this.request({
      method: 'POST',
      path: `/internal/v1/bsp/apps/${appId}/sync-phone`,
      data,
      timeout: 10000,
    });
  }

  static async syncAppCache(appId: string, data: Record<string, unknown>) {
    return this.request({
      method: 'POST',
      path: `/internal/v1/bsp/apps/${appId}/sync-cache`,
      data,
      timeout: 10000,
    });
  }
}
