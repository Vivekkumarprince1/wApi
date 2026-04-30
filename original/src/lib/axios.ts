import axios from 'axios';
import { toast } from 'sonner';
import { config as appConfig } from '@/lib/config';

function resolveApiUrl() {
  let url = '';
  if (typeof window !== 'undefined' && window.location?.origin) {
    url = `${window.location.origin.replace(/\/$/, '')}/api`;
  } else {
    url = `${appConfig.baseUrl.replace(/\/$/, '')}/api`;
  }
  console.log(`[Axios] Resolved API URL: ${url}`);
  return url;
}

const api = axios.create({
  baseURL: resolveApiUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    // Handle 401
    if (error.response?.status === 401) {
      // Dynamic import to avoid circular dependencies
      const { useAuthStore } = await import('@/store/auth-store');
      const isStale = ['STALE_SESSION', 'USER_NOT_FOUND', 'SESSION_EXPIRED'].includes(error.response?.data?.code);
      
      if (isStale) {
        toast.error('Session invalidated. Please login again.');
        useAuthStore.getState().logout?.();
      }
    }

    // Handle 402 (Payment Required)
    if (error.response?.status === 402) {
      const { code, feature } = error.response?.data || {};
      const message = error.response?.data?.message || "Payment required to proceed";
      
      toast.error(message, { id: 'plan-gate-error' });
      
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const isAdminRoute = currentPath.startsWith('/super-admin');
        const isInviteRoute = currentPath.startsWith('/auth/accept-invite');
        
        if (!currentPath.includes('/dashboard/billing') && !currentPath.includes('/super-admin') && !isInviteRoute) {
          const isWalletError = code === 'INSUFFICIENT_WALLET_BALANCE' || code === 'INSUFFICIENT_BALANCE';
          const redirectPath = '/dashboard/billing';
          const query = isWalletError ? '?action=recharge' : `?reason=gate&feature=${feature || 'unknown'}`;
          
          setTimeout(() => {
            window.location.href = redirectPath + query;
          }, 1500);
        }
      }
    }

    const customError: any = new Error(
      error.response?.data?.error || error.response?.data?.message || error.message || 'Request failed'
    );
    customError.errors = error.response?.data?.errors;
    customError.code = error.response?.data?.code;
    customError.status = error.response?.status;
    // Pass through any extra fields from the API response (e.g. redirectToken, redirectEmail)
    const knownFields = ['error', 'message', 'errors', 'code'];
    if (error.response?.data) {
      Object.keys(error.response.data).forEach(key => {
        if (!knownFields.includes(key)) customError[key] = error.response.data[key];
      });
    }

    return Promise.reject(customError);
  }
);

export default api;
export const apiClient = api;
