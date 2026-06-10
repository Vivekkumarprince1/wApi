import axios, { AxiosRequestConfig } from 'axios';
import { config } from '../config/index.js';

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
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function headers(workspaceId?: string, userId?: string) {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-internal-service': 'auth-service',
    'x-internal-secret': config.internalServiceSecret,
    'x-internal-service-secret': config.internalServiceSecret,
    'x-correlation-id': correlationId(),
  };
  if (workspaceId) h['x-workspace-id'] = workspaceId;
  if (userId) h['x-user-id'] = userId;
  return h;
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
    payload: Record<string, unknown>;
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
}
