import axios from 'axios';
import { config } from '../../config';

const BSP_SERVICE_URL = process.env.BSP_SERVICE_URL || 'http://localhost:3004';
const INTERNAL_SECRET = config.internalServiceSecret;

export class BspServiceClient {
  static async providerAction<T = any>(input: {
    workspaceId: string;
    appId: string;
    action: string;
    payload: any;
  }): Promise<T> {
    try {
      const response = await axios.post(`${BSP_SERVICE_URL}/internal/v1/bsp/provider/actions`, {
        provider: 'gupshup',
        appId: input.appId,
        action: input.action,
        payload: input.payload || {}
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': 'automation-service',
          'x-internal-service-secret': INTERNAL_SECRET || '',
          'x-workspace-id': input.workspaceId
        },
        timeout: 30000
      });
      return response.data?.data ?? response.data;
    } catch (err: any) {
      console.error("[BSP Client Error]:", err.response?.data || err.message);
      // Mock fallback for local/testing environments when BSP service isn't active
      if (process.env.NODE_ENV !== 'production') {
        console.warn("[BSP Client Warning]: BSP service error, returning mock fallback");
        if (input.action === 'create_flow') {
          return { flowId: 'mock_flow_' + Date.now(), status: 'DRAFT' } as any;
        }
        if (input.action === 'get_flow_preview_url') {
          return { preview_url: 'https://example.com/mock-flow-preview' } as any;
        }
        return { success: true, mock: true } as any;
      }
      throw err;
    }
  }
}
