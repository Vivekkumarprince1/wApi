import axios, { AxiosError } from 'axios';
import { randomUUID } from 'crypto';
import { config } from '../config';

// 15s timeout matches the automation-service client. Without it, slow
// monolith responses would tie up worker concurrency indefinitely.
const client = axios.create({
  baseURL: config.monolithUrl,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    'x-internal-service-secret': config.internalServiceSecret,
  },
});

client.interceptors.request.use((reqConfig) => {
  if (!reqConfig.headers['x-correlation-id']) {
    reqConfig.headers['x-correlation-id'] = randomUUID();
  }
  return reqConfig;
});

// Normalize every worker-bridge failure into a typed error so callers
// (CampaignService → CampaignController) can map them to meaningful HTTP
// statuses instead of leaking the raw axios message as a 500.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const axiosErr = err as AxiosError<any>;
    const action = (axiosErr.config as any)?.data ? safeParseAction((axiosErr.config as any).data) : 'unknown';
    const url = `${axiosErr.config?.baseURL || ''}${axiosErr.config?.url || ''}`;
    const status = axiosErr.response?.status;
    const code = axiosErr.code;
    const detail = (axiosErr.response?.data as any)?.message || (axiosErr.response?.data as any)?.error || axiosErr.message;
    console.error(`[monolith-bridge] action=${action} url=${url} code=${code} status=${status} msg=${detail}`);
    const tag = status === 404
      ? 'MONOLITH_ROUTE_NOT_FOUND'
      : status && status >= 500
        ? 'MONOLITH_UNAVAILABLE'
        : code === 'ECONNREFUSED' || code === 'ECONNABORTED' || code === 'ENOTFOUND'
          ? 'MONOLITH_UNREACHABLE'
          : 'MONOLITH_ERROR';
    return Promise.reject(new Error(`${tag}: action=${action} url=${url} (${detail})`));
  }
);

function safeParseAction(raw: unknown): string {
  try {
    const body = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
    return body?.action || 'unknown';
  } catch {
    return 'unknown';
  }
}

export const monolithWorkerBridge = {
  async sendTemplate(data: {
    workspaceId: string;
    to: string;
    templateName: string;
    languageCode?: string;
    components?: any[];
    options?: any;
  }) {
    const response = await client.post('/api/internal/worker-bridge', {
      action: 'send-template',
      data,
    });
    return response.data;
  },

  async billingPark(workspaceId: string, amount: number, campaignId: string) {
    await client.post('/api/internal/worker-bridge', {
      action: 'billing-park',
      data: { workspaceId, amount, campaignId },
    });
  },

  /**
   * Settle parked campaign budget. `reservedAmount` / `actualSpend` are paise
   * and must match the monolith worker-bridge billing-settle contract.
   */
  async billingSettle(
    workspaceId: string,
    campaignId: string,
    reservedAmount: number,
    actualSpend: number
  ) {
    await client.post('/api/internal/worker-bridge', {
      action: 'billing-settle',
      data: { workspaceId, campaignId, reservedAmount, actualSpend },
    });
  },

  async preflightValidate(workspaceId: string, templateId: string, contactsCount: number) {
    const response = await client.post('/api/internal/worker-bridge', {
      action: 'preflight-validate',
      data: { workspaceId, templateId, contactsCount },
    });
    return response.data;
  },

  async socketBroadcast(workspaceId: string, event: string, payload: any) {
    await client.post('/api/internal/worker-bridge', {
      action: 'socket-broadcast',
      data: { workspaceId, event, payload },
    });
  },

  async getPricing(workspaceId: string, category: string) {
    const response = await client.post('/api/internal/worker-bridge', {
      action: 'get-pricing',
      data: { workspaceId, category },
    });
    return response.data;
  },

  // workspaceId is now mandatory on every read so the monolith can scope
  // the lookup to a single tenant. The previous unscoped variants were
  // removed when the worker-bridge dispatcher started rejecting calls
  // without it.
  async getTemplate(workspaceId: string, templateId: string) {
    const response = await client.post('/api/internal/worker-bridge', {
      action: 'get-template',
      data: { workspaceId, templateId },
    });
    return response.data;
  },

  async getContact(workspaceId: string, contactId: string) {
    const response = await client.post('/api/internal/worker-bridge', {
      action: 'get-contact',
      data: { workspaceId, contactId },
    });
    return response.data;
  },

  async queryContacts(workspaceId: string, query: any) {
    const response = await client.post('/api/internal/worker-bridge', {
      action: 'query-contacts',
      data: { workspaceId, query },
    });
    return response.data;
  },

  async countContacts(workspaceId: string, query: any) {
    const response = await client.post('/api/internal/worker-bridge', {
      action: 'count-contacts',
      data: { workspaceId, query },
    });
    return response.data;
  },
};
