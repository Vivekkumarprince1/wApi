import { serviceRequest } from './service-client';

export const microserviceWorkerClient = {
  async sendTemplate(data: {
    workspaceId: string;
    to: string;
    templateName: string;
    languageCode?: string;
    components?: any[];
    options?: any;
  }) {
    const response = await serviceRequest('chat', {
      method: 'POST',
      url: '/api/internal/worker-bridge',
      data: {
      action: 'send-template',
      data,
      },
    });
    return response.data;
  },

  async billingPark(workspaceId: string, amount: number, campaignId: string) {
    await serviceRequest('billing', {
      method: 'POST',
      url: `/api/billing/wallets/${workspaceId}/reserve`,
      data: { amount, campaignId },
    });
  },

  /**
   * Settle parked campaign budget. `reservedAmount` / `actualSpend` are paise.
   */
  async billingSettle(
    workspaceId: string,
    campaignId: string,
    reservedAmount: number,
    actualSpend: number
  ) {
    await serviceRequest('billing', {
      method: 'POST',
      url: `/api/billing/wallets/${workspaceId}/settle`,
      data: { campaignId, reservedAmount, actualSpend },
    });
  },

  async preflightValidate(workspaceId: string, templateId: string, contactsCount: number) {
    const response = await serviceRequest('chat', {
      method: 'POST',
      url: '/api/internal/worker-bridge',
      data: {
      action: 'preflight-validate',
      data: { workspaceId, templateId, contactsCount },
      },
    });
    return response.data;
  },

  async socketBroadcast(workspaceId: string, event: string, payload: any) {
    await serviceRequest('chat', {
      method: 'POST',
      url: '/api/internal/worker-bridge',
      data: {
      action: 'socket-broadcast',
      data: { workspaceId, event, payload },
      },
    });
  },

  async getPricing(workspaceId: string, category: string) {
    const response = await serviceRequest('billing', {
      method: 'GET',
      url: `/api/billing/wallets/${workspaceId}/pricing`,
      params: { category },
    });
    return response.data;
  },

  // workspaceId is mandatory on every read so services can scope the lookup to
  // a single tenant.
  async getTemplate(workspaceId: string, templateId: string) {
    const response = await serviceRequest('bsp', {
      method: 'GET',
      url: `/internal/v1/bsp/templates/${templateId}`,
      params: { workspaceId },
      headers: { 'x-workspace-id': workspaceId },
    });
    return response.data;
  },

  async getContact(workspaceId: string, contactId: string) {
    const response = await serviceRequest('contact', {
      method: 'GET',
      url: `/internal/v1/contacts/${contactId}`,
      headers: { 'x-workspace-id': workspaceId },
    });
    return response.data;
  },

  async queryContacts(workspaceId: string, query: any) {
    const response = await serviceRequest('contact', {
      method: 'POST',
      url: '/internal/v1/contacts/query',
      data: { workspaceId, query },
      headers: { 'x-workspace-id': workspaceId },
    });
    return response.data;
  },

  async countContacts(workspaceId: string, query: any) {
    const response = await serviceRequest('contact', {
      method: 'POST',
      url: '/internal/v1/contacts/count',
      data: { workspaceId, query },
      headers: { 'x-workspace-id': workspaceId },
    });
    return response.data;
  },
};
