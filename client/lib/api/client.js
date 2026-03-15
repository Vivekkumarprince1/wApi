import { loadingStore } from './loadingStore';

function resolveApiUrl() {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.length) {
    const clean = envUrl.replace(/\/$/, '');
    return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
  }

  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/api/v1`;
  }

  return 'http://localhost:5001/api/v1';
}

export const API_URL = resolveApiUrl();

export const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

export const isAuthenticated = () => {
  if (typeof window !== 'undefined') {
    return !!localStorage.getItem('token');
  }
  return false;
};

export const getAuthHeaders = () => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const get = async (endpoint) => {
  loadingStore.startRequest();
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Unauthorized');
      }
      const errorData = await response.json();
      const error = new Error(errorData.message || 'Request failed');
      error.errors = errorData.errors;
      error.code = errorData.code;
      error.status = response.status;
      throw error;
    }

    return response.json();
  } finally {
    loadingStore.endRequest();
  }
};

export const post = async (endpoint, data) => {
  loadingStore.startRequest();
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Unauthorized');
      }
      const errorData = await response.json();
      const error = new Error(errorData.message || 'Request failed');
      error.errors = errorData.errors;
      error.code = errorData.code;
      error.status = response.status;
      throw error;
    }

    return response.json();
  } finally {
    loadingStore.endRequest();
  }
};

export const put = async (endpoint, data) => {
  loadingStore.startRequest();
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Unauthorized');
      }
      const errorData = await response.json();
      const error = new Error(errorData.message || 'Request failed');
      error.errors = errorData.errors;
      error.code = errorData.code;
      error.status = response.status;
      throw error;
    }

    return response.json();
  } finally {
    loadingStore.endRequest();
  }
};

export const del = async (endpoint) => {
  loadingStore.startRequest();
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Unauthorized');
      }
      const errorData = await response.json();
      const error = new Error(errorData.message || 'Request failed');
      error.errors = errorData.errors;
      error.code = errorData.code;
      error.status = response.status;
      throw error;
    }

    return response.json();
  } finally {
    loadingStore.endRequest();
  }
};
