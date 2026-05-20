import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

@Injectable()
export class GupshupClientService {
  private readonly partnerClient: AxiosInstance;

  constructor() {
    this.partnerClient = axios.create({
      baseURL: config.gupshup.partnerBaseUrl,
      timeout: 25000,
    });
  }

  async createEmbeddedOnboardingLink(input: {
    workspaceId: string;
    businessId: string;
    callbackUrl: string;
    state: string;
    metadata?: Record<string, unknown>;
  }) {
    // Provider integration placeholder: wire exact Gupshup endpoint here during migration.
    return {
      appId: `pending_${input.workspaceId}`,
      url: `${input.callbackUrl}?state=${encodeURIComponent(input.state)}`,
      providerResponse: { mode: 'stubbed', provider: 'gupshup' },
    };
  }

  async refreshAppToken(appId: string) {
    // Provider integration placeholder.
    return {
      appId,
      token: `pending-token-${appId}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  async sendMessage(input: { appId: string; payload: Record<string, unknown> }) {
    // Provider integration placeholder. The dispatch is stored and shaped as if accepted.
    return {
      id: `dispatch_${Date.now()}`,
      messageId: `wamid.stub.${Date.now()}`,
      appId: input.appId,
      payload: input.payload,
    };
  }

  async getApp(appId: string) {
    return { appId, provider: 'gupshup', mode: 'stubbed' };
  }

  async providerAction(input: { appId?: string; action: string; payload: Record<string, unknown> }) {
    // Provider integration placeholder. This keeps provider-specific calls out of main-service
    // while the exact Gupshup endpoint mapping is migrated into this service.
    return {
      provider: 'gupshup',
      appId: input.appId,
      action: input.action,
      status: 'pending_provider_integration',
      payload: input.payload,
    };
  }
}
