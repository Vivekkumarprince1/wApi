import axios from 'axios';

const MONOLITH_URL = process.env.MONOLITH_INTERNAL_URL || 'http://localhost:5001';

export const monolithClient = axios.create({
  baseURL: MONOLITH_URL,
  headers: {
    'x-internal-service-secret': process.env.INTERNAL_SERVICE_SECRET || 'your-service-secret'
  }
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
