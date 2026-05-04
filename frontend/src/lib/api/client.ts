import axios from 'axios';
import { toast } from 'react-hot-toast';

/**
 * API CLIENT
 * Handles all requests to the backend main-server via the /api proxy.
 */
export const apiClient: any = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response: any) => response.data, // Return data directly for convenience
  (error: any) => {
    const message = error.response?.data?.message || 'Something went wrong';
    if (error.response?.status !== 401) {
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

// Helper exports to match existing API usage patterns
export const get = (url: string, config = {}) => apiClient.get(url, config) as any;
export const post = (url: string, data?: any, config = {}) => apiClient.post(url, data, config) as any;
export const put = (url: string, data?: any, config = {}) => apiClient.put(url, data, config) as any;
export const patch = (url: string, data?: any, config = {}) => apiClient.patch(url, data, config) as any;
export const del = (url: string, config = {}) => apiClient.delete(url, config) as any;

export default apiClient;
