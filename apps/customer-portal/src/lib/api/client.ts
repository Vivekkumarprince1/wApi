import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { toast } from 'react-hot-toast';

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

const baseClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
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
