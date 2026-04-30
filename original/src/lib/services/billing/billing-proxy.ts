import axios, { AxiosRequestConfig } from 'axios';

/**
 * BILLING PROXY CLIENT
 * Centralized utility for all billing-service communications from the monolith.
 * All billing API routes should use this instead of direct axios calls.
 */

const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || 'http://localhost:3003';

export class BillingProxy {
  private static client = axios.create({
    baseURL: BILLING_SERVICE_URL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
  });

  /**
   * Forward a request to the billing service
   */
  static async forward(
    method: string,
    path: string,
    options?: {
      data?: any;
      params?: Record<string, any>;
      workspaceId?: string;
      userId?: string;
    }
  ) {
    const config: AxiosRequestConfig = {
      method,
      url: path,
      data: options?.data,
      params: options?.params,
      headers: {} as Record<string, string>,
      validateStatus: () => true, // Don't throw on error status codes
    };

    if (options?.workspaceId) (config.headers as Record<string, string>)['x-workspace-id'] = options.workspaceId;
    if (options?.userId) (config.headers as Record<string, string>)['x-user-id'] = options.userId;

    return this.client.request(config);
  }

  /**
   * GET from billing service
   */
  static async get(path: string, params?: Record<string, any>) {
    return this.client.get(path, { params, validateStatus: () => true });
  }

  /**
   * POST to billing service
   */
  static async post(path: string, data?: any) {
    return this.client.post(path, data, { validateStatus: () => true });
  }
}
