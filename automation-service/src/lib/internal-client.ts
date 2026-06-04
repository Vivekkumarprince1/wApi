import axios from 'axios';
import { randomUUID } from 'crypto';
import { config } from '../config';

const CHAT_SERVICE_URL = config.chatServiceUrl;
const INTERNAL_SECRET = config.internalServiceSecret;

if (!INTERNAL_SECRET) {
  // Hard-fail at module load. A fallback string would silently let the
  // service talk to a different cluster if the env file was forgotten.
  const msg = '[InternalClient] FATAL: INTERNAL_SERVICE_SECRET is not set.';
  console.error(msg);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(msg);
  }
}

export const chatInternalClient = axios.create({
  baseURL: CHAT_SERVICE_URL,
  timeout: 15_000,
  headers: {
    'x-internal-service-secret': INTERNAL_SECRET || ''
  }
});

chatInternalClient.interceptors.request.use((reqConfig) => {
  if (!reqConfig.headers['x-correlation-id']) {
    reqConfig.headers['x-correlation-id'] = randomUUID();
  }
  return reqConfig;
});

export const sendInternalAction = async (type: string, payload: any) => {
  try {
    const response = await chatInternalClient.post('/api/internal/actions', { type, payload });
    return response.data;
  } catch (error: any) {
    console.error(`[InternalClient] Action ${type} failed:`, error.response?.data || error.message);
    throw error;
  }
};
