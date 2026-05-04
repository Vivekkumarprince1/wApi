import axios from 'axios';

/**
 * BACKEND AXIOS UTILITY
 * For inter-service communication and external API calls.
 */

const api = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const customError: any = new Error(
      error.response?.data?.error || error.response?.data?.message || error.message || 'External request failed'
    );
    customError.status = error.response?.status;
    customError.data = error.response?.data;
    return Promise.reject(customError);
  }
);

export default api;
export const apiClient = api;
