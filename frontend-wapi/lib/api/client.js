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

export const get = (endpoint) => api.get(endpoint);
export const post = (endpoint, data) => api.post(endpoint, data);
export const put = (endpoint, data) => api.put(endpoint, data);
export const patch = (endpoint, data) => api.patch(endpoint, data);
export const del = (endpoint, data = null) => api.delete(endpoint, data ? { data } : {});
