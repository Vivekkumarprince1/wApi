import axios from 'axios';

const MONOLITH_URL = (process.env.MONOLITH_URL || 'http://localhost:3000').replace(/\/+$/, '');
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'your-service-secret';

/**
 * Internal client for calling the monolith.
 * Used for: template validation, contact resolution, lifecycle execution.
 */
export const monolithClient = axios.create({
  baseURL: MONOLITH_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'x-internal-service-secret': INTERNAL_SERVICE_SECRET
  }
});
