import api from '@/lib/axios';

export const apiClient = api;

export const API_URL = api.defaults.baseURL;

export const getToken = () => {
  // Token is now handled via HttpOnly cookies by the browser
  return null;
};

export const isAuthenticated = () => {
  // This should ideally be checked via the authStore's authenticated state
  return typeof document !== 'undefined' && document.cookie.includes('auth_token');
};

export const getAuthHeaders = () => {
  // Authorization header is no longer needed as cookies are used
  return {};
};

export const get = (endpoint: string, config = {}): Promise<any> => api.get(endpoint, config) as Promise<any>;
export const post = (endpoint: string, data?: any, config = {}): Promise<any> => api.post(endpoint, data, config) as Promise<any>;
export const put = (endpoint: string, data?: any, config = {}): Promise<any> => api.put(endpoint, data, config) as Promise<any>;
export const patch = (endpoint: string, data?: any, config = {}): Promise<any> => api.patch(endpoint, data, config) as Promise<any>;
export const del = (endpoint: string, config = {}): Promise<any> => api.delete(endpoint, config) as Promise<any>;

export default apiClient;
