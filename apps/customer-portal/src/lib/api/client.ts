import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { toast } from 'react-hot-toast';
import config from '@/lib/config';

/**
 * API CLIENT
 *
 * The response interceptor below strips `response.data`, so every method
 * returns the parsed JSON body directly. We re-type the standard axios
 * methods so callers get the body type instead of `AxiosResponse<T>`.
 *
 * For new code, prefer importing types from `@wapi/contracts` and using
 * `apiClient.get<T>('/route')` so the call site is fully typed.
 */
export interface ApiClient extends Omit<AxiosInstance,
  'get' | 'post' | 'put' | 'patch' | 'delete'
> {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  put<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  patch<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
}

const normalizeApiBaseUrl = (apiUrl: string) => {
  const base = apiUrl.replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) return base;
  if (base.endsWith('/api')) return `${base}/v1`;
  return `${base}/api/v1`;
};

const baseClient = axios.create({
  baseURL: normalizeApiBaseUrl(config.apiUrl),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'ConnectSpherePortal',
  },
});

baseClient.interceptors.request.use((requestConfig) => {
  if (typeof window === 'undefined') return requestConfig;

  const token = sessionStorage.getItem('socket_auth_token');
  if (!token) return requestConfig;

  requestConfig.headers = requestConfig.headers || {};
  if (!requestConfig.headers.Authorization) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }

  return requestConfig;
});

baseClient.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error) => {
    const message = error?.response?.data?.message || 'Something went wrong';
    if (error?.response?.status !== 401) {
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export const apiClient = baseClient as unknown as ApiClient;

export const get = <T = any>(url: string, config?: AxiosRequestConfig) =>
  apiClient.get<T>(url, config);
export const post = <T = any>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  apiClient.post<T>(url, data, config);
export const put = <T = any>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  apiClient.put<T>(url, data, config);
export const patch = <T = any>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  apiClient.patch<T>(url, data, config);
export const del = <T = any>(url: string, config?: AxiosRequestConfig) =>
  apiClient.delete<T>(url, config);

export const unwrapData = <T = any>(payload: any): T =>
  payload && typeof payload === 'object' && 'data' in payload
    ? payload.data
    : payload;

export default apiClient;
