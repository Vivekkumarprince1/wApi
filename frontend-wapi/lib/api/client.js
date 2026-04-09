import api from '@/lib/axios';

export const apiClient = api;

export const API_URL = api.defaults.baseURL;

export const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

export const isAuthenticated = () => {
  return !!getToken();
};

export const getAuthHeaders = () => {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const get = (endpoint, config = {}) => api.get(endpoint, config);
export const post = (endpoint, data, config = {}) => api.post(endpoint, data, config);
export const put = (endpoint, data, config = {}) => api.put(endpoint, data, config);
export const patch = (endpoint, data, config = {}) => api.patch(endpoint, data, config);
export const del = (endpoint, config = {}) => api.delete(endpoint, config);
