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
    try {
      const response = await client.post('/api/internal/worker-bridge', {
        action: 'preflight-validate',
        data: { workspaceId, templateId, contactsCount },
      });
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError<any>;
      const status = axiosErr.response?.status;
      const code = axiosErr.code;
      const detail = (axiosErr.response?.data as any)?.message || axiosErr.message;
      console.error(`[monolith-bridge] preflightValidate failed code=${code} status=${status} msg=${detail}`);
      throw new Error(`PREFLIGHT_UNAVAILABLE: ${code || status || 'unknown'}${detail ? ` (${detail})` : ''}`);
    }
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
