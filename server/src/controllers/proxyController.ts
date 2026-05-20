import { Response, NextFunction } from 'express';
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import pRetry from 'p-retry';
import { AuthRequest } from '../middlewares/authMiddleware';
import { config } from '../config';
import { logActivity } from '../services/activity-logging-service';
import { getCorrelationId } from '../utils/logger';

type ProxyService = 'automation' | 'campaign' | 'billing' | 'bsp';

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

const FAILURE_THRESHOLD = 3; // Reduced from 5
const RESET_TIMEOUT = 60000; // Increased to 60s
const REQUEST_TIMEOUT = 5000; // Reduced from 10s

const circuitState: Record<ProxyService, CircuitState> = {
  automation: { failures: 0, lastFailure: 0, isOpen: false },
  campaign: { failures: 0, lastFailure: 0, isOpen: false },
  billing: { failures: 0, lastFailure: 0, isOpen: false },
  bsp: { failures: 0, lastFailure: 0, isOpen: false },
};

function stripApiPrefix(originalUrl: string) {
  const withoutQuery = originalUrl.split('?')[0] || '/';
  // Strip common API prefixes to get the clean service path
  return withoutQuery.replace(/^\/api\/v1/, '').replace(/^\/api/, '') || '/';
}

function getServiceBaseUrl(service: ProxyService) {
  const serviceUrls: Record<ProxyService, string> = {
    automation: config.automationServiceUrl,
    campaign: config.campaignServiceUrl,
    billing: config.billingServiceUrl,
    bsp: config.bspServiceUrl,
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

  console.log(`[ProxyController] buildServiceUrl - service: ${service}, pathString: ${pathString}, workspaceId: ${workspaceId}`);

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

  if (pathString.startsWith('/super-admin/plans')) {
    const relativePath = pathString.slice('/super-admin/plans'.length);
    if (relativePath.startsWith('/seed')) {
      return `${targetBaseUrl}/api/billing/admin/plans/seed`;
    }
    if (relativePath === '' || relativePath === '/') {
      if (req.method === 'POST') {
        return `${targetBaseUrl}/api/billing/admin/plans`;
      }
      return `${targetBaseUrl}/api/billing/plans`;
    }
    const planId = relativePath.replace(/^\//, '');
    if (req.method === 'PUT' || req.method === 'PATCH') {
      return `${targetBaseUrl}/api/billing/admin/plans/${planId}`;
    }
    if (req.method === 'DELETE') {
      return `${targetBaseUrl}/api/billing/admin/plans/${planId}`;
    }
    return `${targetBaseUrl}/api/billing/plans/${planId}`;
  }

  if (pathString.startsWith('/workspace/billing/')) {
    const relativePath = pathString.slice('/workspace/billing/'.length);
    console.log(`[ProxyController] /workspace/billing/ handler - relativePath: ${relativePath}, workspaceId: ${workspaceId}`);
    
    if (workspaceId && (relativePath === '' || relativePath === 'info')) {
      const url = `${targetBaseUrl}/api/billing/wallets/${workspaceId}`;
      console.log(`[ProxyController] Returning URL for info: ${url}`);
      return url;
    }
    if (workspaceId && relativePath === 'recharge') {
      const url = `${targetBaseUrl}/api/billing/wallets/${workspaceId}/recharge`;
      console.log(`[ProxyController] Returning URL for recharge: ${url}`);
      return url;
    }
    if (workspaceId && relativePath === 'plan') {
      const url = `${targetBaseUrl}/api/billing/wallets/${workspaceId}/plan`;
      console.log(`[ProxyController] Returning URL for plan: ${url}`);
      return url;
    }
    if (workspaceId && relativePath === 'payment-method') {
      const url = `${targetBaseUrl}/api/billing/wallets/${workspaceId}/verify-order`;
      console.log(`[ProxyController] Returning URL for payment-method: ${url}`);
      return url;
    }
    if (relativePath === 'payment-method/verify') {
      const url = `${targetBaseUrl}/api/billing/wallets/payment-method/verify`;
      console.log(`[ProxyController] Returning URL for payment-method/verify: ${url}`);
      return url;
    }
    if (relativePath === 'recharge/verify') {
      const url = `${targetBaseUrl}/api/billing/wallets/recharge/verify`;
      console.log(`[ProxyController] Returning URL for recharge/verify: ${url}`);
      return url;
    }
    if (relativePath === 'plan/verify') {
      const url = `${targetBaseUrl}/api/billing/wallets/plan/verify`;
      console.log(`[ProxyController] Returning URL for plan/verify: ${url}`);
      return url;
    }
    if (relativePath.startsWith('invoices/')) {
      const url = `${targetBaseUrl}/api/billing/wallets/${relativePath}`;
      console.log(`[ProxyController] Returning URL for invoices: ${url}`);
      return url;
    }
    const url = `${targetBaseUrl}/api/billing/wallets/${relativePath}`;
    console.log(`[ProxyController] Returning default URL for workspace/billing: ${url}`);
    return url;
  }

  if (service === 'bsp') {
    if (pathString.startsWith('/onboarding/bsp/')) {
      const relativePath = pathString.replace(/^\/onboarding\/bsp\/?/, '');
      return `${targetBaseUrl}/bsp/v1/onboarding/${relativePath}`;
    }
    if (pathString.startsWith('/onboarding/')) {
      const relativePath = pathString.replace(/^\/onboarding\/?/, '');
      return `${targetBaseUrl}/bsp/v1/onboarding/${relativePath}`;
    }
    if (pathString.startsWith('/bsp/')) {
      const relativePath = pathString.replace(/^\/bsp\/?/, '');
      return `${targetBaseUrl}/bsp/v1/${relativePath}`;
    }
    const relativePath = pathString.replace(/^\//, '');
    return `${targetBaseUrl}/bsp/v1/${relativePath}`;
  }

  return `${targetBaseUrl}/api/billing`;
}

function buildProxyHeaders(context: ProxyContext = {}, extraHeaders: Record<string, string> = {}) {
  assertInternalSecret();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-internal-service': 'main-service',
    'x-internal-secret': config.internalServiceSecret,
    'x-internal-service-secret': config.internalServiceSecret,
    'x-correlation-id':
      context.correlationId || getCorrelationId() || generateCorrelationId(),
    ...extraHeaders,
  };

  if (context.workspaceId) headers['x-workspace-id'] = context.workspaceId;
  if (context.userId) headers['x-user-id'] = context.userId;
  if (context.userRole) headers['x-user-role'] = context.userRole;

  console.log(`[buildProxyHeaders] Built headers:`, {
    'x-workspace-id': headers['x-workspace-id'],
    'x-user-id': headers['x-user-id'],
    'x-user-role': headers['x-user-role'],
    'x-correlation-id': headers['x-correlation-id'],
    'x-internal-service-secret': headers['x-internal-service-secret'] ? '***' : 'NOT SET'
  });

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

    console.log(`[ProxyController] forwardToService - service: ${service}, method: ${options.method}, path: ${options.path}, url: ${url}`);
    console.log(`[ProxyController] forwardToService - data: ${JSON.stringify(options.data)}`);
    console.log(`[ProxyController] forwardToService - workspaceId: ${options.workspaceId}, userId: ${options.userId}`);

    const timeout = parseInt(options.headers?.['x-timeout'] || '') || REQUEST_TIMEOUT;
    const retries = options.headers?.['x-no-retry'] ? 0 : 2;

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
            timeout,
            validateStatus: () => true,
          }),
        {
          retries,
          minTimeout: 500,
          onFailedAttempt: (error: any) => {
            const status = error.response?.status;
            const msg = error.response?.data?.message || error.message || 'Unknown Error';
            console.warn(`[ProxyController][${correlationId}] Attempt ${error.attemptNumber} failed targeting ${options.method} ${url}: [${status || 'N/A'}] ${msg}`);
          },
        }
      );

      recordSuccess(service);

      // Log activity for mutations (POST, PUT, DELETE)
      if (['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase()) && response.status < 300) {
        const entityType = service; // automation, campaign, billing
        const action = options.method.toUpperCase() === 'POST' ? 'create' : (options.method.toUpperCase() === 'DELETE' ? 'delete' : 'update');
        const entityName = (options.data as any)?.name || (options.data as any)?.title || (options.data as any)?.label || '';

        // We need a request object to log activity. 
        // If we don't have one (e.g. called from a background task), we skip logging for now
        // But forwardToService usually has userId/workspaceId in options
        if (options.userId && options.workspaceId) {
          // Construct a partial request for logActivity
          const mockReq = {
            user: { _id: options.userId },
            workspace: { _id: options.workspaceId },
            role: options.userRole,
            ip: '127.0.0.1',
            get: () => 'System/Proxy'
          } as any;

          logActivity(mockReq, action, entityType, {
            entityId: (response.data as any)?.data?._id || (response.data as any)?._id,
            entityName,
            status: 'success'
          }).catch(() => null);
        }
      }

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
