import axios from 'axios';
import { loadingStore } from './api/loadingStore';
import { toast } from 'react-hot-toast';

function resolveApiUrl() {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.length) {
    return envUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/api/v1`;
  }

  return 'http://localhost:5001/api/v1';
}

const api = axios.create({
  baseURL: resolveApiUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for API calls
api.interceptors.request.use(
  (config) => {
    loadingStore.startRequest();
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    loadingStore.endRequest();
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
api.interceptors.response.use(
  (response) => {
    loadingStore.endRequest();
    return response.data; // Return raw data directly
  },
  async (error) => {
    loadingStore.endRequest();
    
    // Handle 401
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
      }
    }

    // Handle 402 (Payment Required / Plan Limit / Wallet Balance)
    if (error.response?.status === 402) {
      const { code, feature } = error.response?.data || {};
      const message = error.response?.data?.message || "Payment required to proceed";
      
      toast.error(message, { id: 'plan-gate-error' });
      
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/dashboard/billing') && !currentPath.includes('/admin')) {
          // If wallet balance error, redirect to recharge section
          const isWalletError = code === 'INSUFFICIENT_WALLET_BALANCE' || code === 'INSUFFICIENT_BALANCE';
          const redirectPath = '/dashboard/billing';
          const query = isWalletError ? '?action=recharge' : `?reason=gate&feature=${feature || 'unknown'}`;
          
          setTimeout(() => {
            window.location.href = redirectPath + query;
          }, 1500);
        }
      }
    }

    // Format error identically to legacy api client
    const customError = new Error(
      error.response?.data?.message || error.message || 'Request failed'
    );
    customError.errors = error.response?.data?.errors;
    customError.code = error.response?.data?.code;
    customError.status = error.response?.status;
    
    return Promise.reject(customError);
  }
);

export default api;
