import axios from 'axios';
import { randomUUID } from 'crypto';

const MONOLITH_URL = process.env.MONOLITH_INTERNAL_URL || 'http://localhost:5001';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET;

if (!INTERNAL_SECRET) {
  // Hard-fail at module load. A fallback string would silently let the
  // service talk to a different cluster if the env file was forgotten.
  const msg = '[InternalClient] FATAL: INTERNAL_SERVICE_SECRET is not set.';
  console.error(msg);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(msg);
  }
}

export const monolithClient = axios.create({
  baseURL: MONOLITH_URL,
  timeout: 15_000,
  headers: {
    'x-internal-service-secret': INTERNAL_SECRET || ''
  }
});

monolithClient.interceptors.request.use((reqConfig) => {
  if (!reqConfig.headers['x-correlation-id']) {
    reqConfig.headers['x-correlation-id'] = randomUUID();
  }
  return reqConfig;
});

export const sendInternalAction = async (type: string, payload: any) => {
  try {
    const response = await monolithClient.post('/api/internal/actions', { type, payload });
    return response.data;
  } catch (error: any) {
    console.error(`[InternalClient] Action ${type} failed:`, error.response?.data || error.message);
    throw error;
  }
};
