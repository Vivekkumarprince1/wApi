import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { resolveAppToken } from '../services/bsp/gupshup-token-service';

/**
 * GUPSHUP CLIENT FACTORY
 * Standardized way to create authenticated axios instances for Gupshup APIs.
 * Supports autonomous token resolution and self-healing.
 */
export class GupshupClientFactory {
  private static clients: Map<string, AxiosInstance> = new Map();

  /**
   * Creates a client for the standard Gupshup V3 Messaging API
   */
  static create(apiKey?: string) {
    return axios.create({
      baseURL: config.gupshupApiBaseUrl || 'https://api.gupshup.io',
      headers: {
        'apikey': apiKey || config.gupshupApiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  /**
   * Creates a client for the Gupshup Partner API
   */
  static createPartner() {
    return axios.create({
      baseURL: config.gupshupPartnerBaseUrl,
      headers: {
        'token': config.gupshupPartnerToken,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get an autonomous Axios instance for a specific appId
   * These instances automatically handle token resolution and self-healing.
   */
  static getClient(appId: string): AxiosInstance {
    if (this.clients.has(appId)) {
      return this.clients.get(appId)!;
    }

    const client = axios.create({
      baseURL: config.gupshupPartnerBaseUrl,
      timeout: 30000,
    });

    // --- REQUEST INTERCEPTOR: Auto-Inject Fresh Token ---
    client.interceptors.request.use(async (axiosConfig) => {
      try {
        const token = await resolveAppToken(appId);
        
        if (token) {
          const normalized = token.trim();
          axiosConfig.headers['Authorization'] = normalized;
          axiosConfig.headers['token'] = normalized;
        }
        
        return axiosConfig;
      } catch (error) {
        console.error(`[GupshupClient:${appId}] Failed to resolve token for request`, error);
        return axiosConfig;
      }
    });

    // --- RESPONSE INTERCEPTOR: Self-Healing (Retry on 401) ---
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;

        if ((status === 401 || status === 403) && !originalRequest._retry) {
          originalRequest._retry = true;
          
          console.warn(`[GupshupClient:${appId}] Auth failure (401/403). Triggering autonomous healing...`);
          
          try {
            const newToken = await resolveAppToken(appId, true);
            
            if (newToken) {
              const normalized = newToken.trim();
              originalRequest.headers['Authorization'] = normalized;
              originalRequest.headers['token'] = normalized;
              
              console.log(`[GupshupClient:${appId}] Healing successful! Retrying original request.`);
              return client(originalRequest);
            }
          } catch (refreshError) {
            console.error(`[GupshupClient:${appId}] Autonomous healing failed`, refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    this.clients.set(appId, client);
    return client;
  }
}

export const createGupshupClient = GupshupClientFactory.create;
export const createGupshupPartnerClient = GupshupClientFactory.createPartner;
