import axios, { type AxiosRequestConfig } from 'axios';
import { config } from '../config';

type ServiceName = 'billing' | 'monolith';

type CircuitState = {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
};

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT = 30000;
const DEFAULT_TIMEOUT = 10000;

const circuitState: Record<ServiceName, CircuitState> = {
  billing: { failures: 0, lastFailure: 0, isOpen: false },
  monolith: { failures: 0, lastFailure: 0, isOpen: false },
};

function baseUrlFor(service: ServiceName) {
  return service === 'billing' ? config.billingServiceUrl : config.monolithUrl;
}

function generateCorrelationId() {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function ensureCircuitClosed(service: ServiceName) {
  const state = circuitState[service];
  if (!state.isOpen) return;

  if (Date.now() - state.lastFailure > RESET_TIMEOUT) {
    state.isOpen = false;
    state.failures = 0;
    return;
  }

  throw new Error(`Circuit open for ${service}`);
}

function recordSuccess(service: ServiceName) {
  circuitState[service].failures = 0;
  circuitState[service].isOpen = false;
}

function recordFailure(service: ServiceName) {
  const state = circuitState[service];
  state.failures += 1;
  state.lastFailure = Date.now();
  if (state.failures >= FAILURE_THRESHOLD) {
    state.isOpen = true;
  }
}

export async function serviceRequest<T = any>(
  service: ServiceName,
  request: AxiosRequestConfig,
  options: { retries?: number } = {}
) {
  ensureCircuitClosed(service);

  const retries = options.retries ?? 2;
  const url = `${baseUrlFor(service).replace(/\/$/, '')}${request.url || ''}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-internal-service-secret': config.internalServiceSecret,
    'x-correlation-id': generateCorrelationId(),
    ...(request.headers || {}),
  };

  let attempt = 0;
  let lastError: any;

  while (attempt <= retries) {
    try {
      const response = await axios<T>({
        ...request,
        url,
        headers,
        timeout: request.timeout ?? DEFAULT_TIMEOUT,
        validateStatus: () => true,
      });
      recordSuccess(service);
      return response;
    } catch (error: any) {
      lastError = error;
      attempt += 1;
      console.warn(`[Campaign ServiceClient] Attempt ${attempt} failed for ${service} ${url}: ${error.message}`);
      if (attempt > retries) {
        recordFailure(service);
        throw error;
      }
    }
  }

  recordFailure(service);
  throw lastError;
}
