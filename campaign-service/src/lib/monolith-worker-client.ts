import axios from 'axios';
import { config } from '../config';

const client = axios.create({
  baseURL: config.monolithUrl,
  headers: {
    'Content-Type': 'application/json',
    'x-internal-service-secret': config.internalServiceSecret,
  },
});

export const monolithWorkerBridge = {
  async sendTemplate(data: { 
    workspaceId: string; 
    to: string; 
    templateName: string; 
    languageCode?: string; 
    components?: any[]; 
    options?: any 
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

  async billingSettle(workspaceId: string, campaignId: string, successAmount: number, failAmount: number) {
    await client.post('/api/internal/worker-bridge', {
      action: 'billing-settle',
      data: { workspaceId, campaignId, successAmount, failAmount },
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

  async getTemplate(templateId: string) {
    const response = await client.post('/api/internal/worker-bridge', {
      action: 'get-template',
      data: { templateId },
    });
    return response.data;
  },

  async getContact(contactId: string) {
    const response = await client.post('/api/internal/worker-bridge', {
      action: 'get-contact',
      data: { contactId },
    });
    return response.data;
  },

  async queryContacts(query: any) {
    const response = await client.post('/api/internal/worker-bridge', {
      action: 'query-contacts',
      data: { query },
    });
    return response.data;
  },

  async countContacts(query: any) {
    const response = await client.post('/api/internal/worker-bridge', {
      action: 'count-contacts',
      data: { query },
    });
    return response.data;
  },
};
