import axios, { AxiosInstance } from 'axios';
import { bspConfig } from '../config/bsp-config';
import { resolveAppToken } from '../services/bsp/gupshup-token-service';

/**
 * Gupshup Client Factory
 * 
 * Provides "Autonomous" Axios instances for specific Gupshup Apps.
 * These instances automatically handle token resolution, injection, 
 * and "Self-Healing" (auto-refresh on 401/403).
 */
export class GupshupClientFactory {
  private static clients: Map<string, AxiosInstance> = new Map();

  /**
   * Get an autonomous Axios instance for a specific appId
   */
  static getClient(appId: string): AxiosInstance {
    if (this.clients.has(appId)) {
      return this.clients.get(appId)!;
    }

    const client = axios.create({
      baseURL: bspConfig.gupshup.partnerBaseUrl,
      timeout: 30000,
    });

    // --- REQUEST INTERCEPTOR: Auto-Inject Fresh Token ---
    client.interceptors.request.use(async (config) => {
      try {
        // Fetch fresh token (uses memory/Redis cache internally)
        const token = await resolveAppToken(appId);
        
        if (token) {
          const normalized = token.trim();
          // Apply both common Gupshup header variants for maximum compatibility
          config.headers['Authorization'] = normalized;
          config.headers['token'] = normalized;
        }
        
        return config;
      } catch (error) {
        console.error(`[GupshupClient:${appId}] Failed to resolve token for request`, error);
        return config;
      }
    });

    // --- RESPONSE INTERCEPTOR: Self-Healing (Retry on 401) ---
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;

        // If 401/403 and we haven't retried yet
        if ((status === 401 || status === 403) && !originalRequest._retry) {
          originalRequest._retry = true;
          
          console.warn(`[GupshupClient:${appId}] Auth failure (401/403). Triggering autonomous healing...`);
          
          try {
            // Force a fresh token fetch from Gupshup (bypass cache)
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
