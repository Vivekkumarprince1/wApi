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

export const get = (endpoint, config = {}) => api.get(endpoint, config);
export const post = (endpoint, data, config = {}) => api.post(endpoint, data, config);
export const put = (endpoint, data, config = {}) => api.put(endpoint, data, config);
export const patch = (endpoint, data, config = {}) => api.patch(endpoint, data, config);
export const del = (endpoint, config = {}) => api.delete(endpoint, config);
