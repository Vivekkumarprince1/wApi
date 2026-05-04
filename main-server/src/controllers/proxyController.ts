import { Response, NextFunction } from 'express';
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import pRetry from 'p-retry';
import { AuthRequest } from '../middlewares/authMiddleware';
import { config } from '../config';

type ProxyService = 'automation' | 'campaign' | 'billing';

type ProxyContext = {
  workspaceId?: string;
  userId?: string;
  userRole?: string;
  correlationId?: string;
};

type ForwardToServiceOptions = ProxyContext & {
  method: string;
  path: string;
  data?: unknown;
  params?: unknown;
  responseType?: AxiosRequestConfig['responseType'];
  headers?: Record<string, string>;
};

type CircuitState = {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
};

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT = 30000;
const REQUEST_TIMEOUT = 10000;

const circuitState: Record<ProxyService, CircuitState> = {
  automation: { failures: 0, lastFailure: 0, isOpen: false },
  campaign: { failures: 0, lastFailure: 0, isOpen: false },
  billing: { failures: 0, lastFailure: 0, isOpen: false },
};

function stripApiPrefix(originalUrl: string) {
  const withoutQuery = originalUrl.split('?')[0] || '/';
  return withoutQuery.replace(/^\/api\/v1/, '') || '/';
}

function getServiceBaseUrl(service: ProxyService) {
  const serviceUrls: Record<ProxyService, string> = {
    automation: config.automationServiceUrl,
    campaign: config.campaignServiceUrl,
    billing: config.billingServiceUrl,
  };

  const url = serviceUrls[service];
  if (!url) {
    console.error(`[ProxyController] No URL configured for service: ${service}`);
    throw new Error(`SERVICE_URL_MISSING: ${service}`);
  }

  return url;
}

function generateCorrelationId() {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function assertInternalSecret() {
  const secret = config.internalServiceSecret;
  if (!secret) {
    console.error('[ProxyController] FATAL: INTERNAL_SERVICE_SECRET is missing in environment.');
    throw new Error('INTERNAL_SERVICE_SECRET_MISSING');
  }
  if (secret.length < 16) {
    console.warn('[ProxyController] WARNING: INTERNAL_SERVICE_SECRET is too short for production use.');
  }
}

function normalizeCampaignPath(pathString: string) {
  let relativePath = pathString;

  // Case 1: Path starts with /campaign/campaigns/ or /campaign/campaigns
  if (relativePath.startsWith('/campaign/campaigns/')) {
    relativePath = 'campaigns/' + relativePath.slice('/campaign/campaigns/'.length);
  } else if (relativePath === '/campaign/campaigns') {
    relativePath = 'campaigns';
  }
  // Case 2: Path starts with /campaign/segments/ or /campaign/segments
  else if (relativePath.startsWith('/campaign/segments/')) {
    relativePath = 'segments/' + relativePath.slice('/campaign/segments/'.length);
  } else if (relativePath === '/campaign/segments') {
    relativePath = 'segments';
  }
  // Case 3: Path starts with /campaign/
  else if (relativePath.startsWith('/campaign/')) {
    relativePath = relativePath.slice('/campaign/'.length);
  }
  // Case 4: Path is exactly /campaign
  else if (relativePath === '/campaign') {
    relativePath = '';
  }
  // Case 5: Path starts with /campaigns or /segments (without /campaign prefix)
  else if (relativePath.startsWith('/campaigns')) {
    relativePath = relativePath.slice(1);
  } else if (relativePath.startsWith('/segments')) {
    relativePath = relativePath.slice(1);
  }
  // Default: remove leading slash if any
  else {
    relativePath = relativePath.replace(/^\//, '');
  }

  return relativePath;
}

function buildServiceUrl(service: ProxyService, targetBaseUrl: string, req: AuthRequest) {
  const pathString = stripApiPrefix(req.originalUrl);
  const workspaceId = req.workspace?._id?.toString();

  if (service === 'automation') {
    const relativePath = pathString.replace(/^\/automation\/?/, '');
    if (relativePath.startsWith('engine/')) {
      return `${targetBaseUrl}/api/automation/${relativePath}`;
    }
    return `${targetBaseUrl}/api/automation/engine${relativePath ? `/${relativePath}` : ''}`;
  }

  if (service === 'campaign') {
    const relativePath = normalizeCampaignPath(pathString);
    return `${targetBaseUrl}/api/campaign${relativePath ? `/${relativePath}` : ''}`;
  }

  if (pathString.startsWith('/billing/')) {
    const relativePath = pathString.slice('/billing/'.length);
    if (relativePath === 'recharge' && workspaceId) {
      return `${targetBaseUrl}/api/billing/wallets/${workspaceId}/recharge`;
    }
    if (relativePath === 'verify-payment' || relativePath === 'recharge/verify') {
      return `${targetBaseUrl}/api/billing/wallets/recharge/verify`;
    }
    if (relativePath === 'plan/verify') {
      return `${targetBaseUrl}/api/billing/wallets/plan/verify`;
    }
    if (relativePath === 'payment-method/verify') {
      return `${targetBaseUrl}/api/billing/wallets/payment-method/verify`;
    }
    return `${targetBaseUrl}/api/billing/${relativePath}`;
  }

  if (pathString.startsWith('/workspace/billing/')) {
    const relativePath = pathString.slice('/workspace/billing/'.length);
    if (workspaceId && (relativePath === '' || relativePath === 'info')) {
      return `${targetBaseUrl}/api/billing/wallets/${workspaceId}`;
    }
    if (workspaceId && relativePath === 'recharge') {
      return `${targetBaseUrl}/api/billing/wallets/${workspaceId}/recharge`;
    }
    if (workspaceId && relativePath === 'payment-method') {
      return `${targetBaseUrl}/api/billing/wallets/${workspaceId}/verify-order`;
    }
    if (relativePath === 'payment-method/verify') {
      return `${targetBaseUrl}/api/billing/wallets/payment-method/verify`;
    }
    if (relativePath === 'recharge/verify') {
      return `${targetBaseUrl}/api/billing/wallets/recharge/verify`;
    }
    if (relativePath === 'plan/verify') {
      return `${targetBaseUrl}/api/billing/wallets/plan/verify`;
    }
    if (relativePath.startsWith('invoices/')) {
      return `${targetBaseUrl}/api/billing/wallets/${relativePath}`;
    }
    return `${targetBaseUrl}/api/billing/wallets/${relativePath}`;
  }

  return `${targetBaseUrl}/api/billing`;
}

function buildProxyHeaders(context: ProxyContext = {}, extraHeaders: Record<string, string> = {}) {
  assertInternalSecret();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-internal-service-secret': config.internalServiceSecret,
    'x-correlation-id': context.correlationId || generateCorrelationId(),
    ...extraHeaders,
  };

  if (context.workspaceId) headers['x-workspace-id'] = context.workspaceId;
  if (context.userId) headers['x-user-id'] = context.userId;
  if (context.userRole) headers['x-user-role'] = context.userRole;

  return headers;
}

function ensureCircuitClosed(service: ProxyService) {
  const state = circuitState[service];
  if (!state.isOpen) return;

  if (Date.now() - state.lastFailure > RESET_TIMEOUT) {
    state.isOpen = false;
    state.failures = 0;
    return;
  }

  throw new Error('CIRCUIT_OPEN');
}

function recordSuccess(service: ProxyService) {
  circuitState[service].failures = 0;
  circuitState[service].isOpen = false;
}

function recordFailure(service: ProxyService) {
  const state = circuitState[service];
  state.failures += 1;
  state.lastFailure = Date.now();
  if (state.failures >= FAILURE_THRESHOLD) {
    state.isOpen = true;
  }
}

export const proxyController = {
  buildProxyHeaders,

  async forwardToService(service: ProxyService, options: ForwardToServiceOptions) {
    ensureCircuitClosed(service);

    const url = `${getServiceBaseUrl(service).replace(/\/$/, '')}${options.path}`;
    const headers = buildProxyHeaders(options, options.headers);
    const correlationId = headers['x-correlation-id'];

    try {
      const response = await pRetry(
        async () =>
          axios({
            method: options.method,
            url,
            data: options.method.toUpperCase() === 'GET' ? undefined : options.data,
            params: options.params,
            headers,
            responseType: options.responseType,
            timeout: REQUEST_TIMEOUT,
            validateStatus: () => true,
          }),
        {
          retries: 2,
          onFailedAttempt: (error: any) => {
            const status = error.response?.status;
            const msg = error.response?.data?.message || error.message || 'Unknown Error';
            console.warn(`[ProxyController][${correlationId}] Attempt ${error.attemptNumber} failed targeting ${options.method} ${url}: [${status || 'N/A'}] ${msg}`);
          },
        }
      );

      recordSuccess(service);
      return response;
    } catch (error: any) {
      recordFailure(service);
      const status = error.response?.status;
      const data = error.response?.data;
      console.error(`[ProxyController][${correlationId}] Final failure for ${options.method} ${url}:`, {
        status,
        message: error.message,
        data: typeof data === 'object' ? JSON.stringify(data) : data
      });
      throw error;
    }
  },

  /**
   * Generic proxy handler for microservices with resilience
   */
  async proxyTo(service: ProxyService, req: AuthRequest, res: Response, _next: NextFunction) {
    const correlationId = typeof req.headers['x-correlation-id'] === 'string' ? req.headers['x-correlation-id'] : generateCorrelationId();
    
    try {
      const targetBaseUrl = getServiceBaseUrl(service);
      const targetUrl = buildServiceUrl(service, targetBaseUrl, req);
      const path = targetUrl.replace(targetBaseUrl.replace(/\/$/, ''), '');

      const response = await this.forwardToService(service, {
        method: req.method,
        path,
        data: req.body,
        params: req.query,
        workspaceId: req.workspace?._id?.toString(),
        userId: req.user?._id?.toString(),
        userRole: req.role || req.user?.role,
        correlationId,
        responseType: req.path.includes('/download') ? 'text' : 'json',
      });

      const contentType = response.headers['content-type'];
      if (contentType && typeof contentType === 'string') {
        res.setHeader('Content-Type', contentType);
      }

      // Propagate correlation ID back
      res.setHeader('x-correlation-id', correlationId);

      if (typeof response.data === 'string') {
        return res.status(response.status).send(response.data);
      }

      return res.status(response.status).json(response.data);
    } catch (error: any) {
      if (error.message === 'CIRCUIT_OPEN') {
        return res.status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Service temporarily unavailable (circuit breaker open)',
          correlationId
        });
      }

      return res.status(502).json({
        success: false,
        error: 'BAD_GATEWAY',
        message: 'Microservice unreachable after multiple attempts',
        details: error.message,
        correlationId
      });
    }
  },
};
