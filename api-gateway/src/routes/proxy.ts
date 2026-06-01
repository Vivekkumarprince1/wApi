import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticateGateway } from '../middlewares/auth';
import { config } from '../config';

const getProxyOptions = (req: FastifyRequest) => {
  return {
    rewriteRequestHeaders: (originalReq: any, headers: any) => {
      const correlationId =
        (headers['x-correlation-id'] as string) ||
        `corr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      const newHeaders: Record<string, string> = {};
      
      // Copy over existing headers
      Object.keys(headers).forEach((key) => {
        if (headers[key] !== undefined) {
          newHeaders[key] = String(headers[key]);
        }
      });

      // Inject secure boundary credentials
      newHeaders['x-internal-service-secret'] = config.internalServiceSecret;
      newHeaders['x-correlation-id'] = correlationId;

      // Inject user/workspace context if resolved statelessly
      if (req.user) {
        newHeaders['x-user-id'] = req.user.id;
        if (req.user.workspaceId) {
          newHeaders['x-workspace-id'] = req.user.workspaceId;
        }
        if (req.user.role) {
          newHeaders['x-user-role'] = req.user.role;
        }
        newHeaders['x-user-impersonating'] = String(!!req.user.isImpersonating);
      }

      console.log(`[API Gateway] Proxying route [${originalReq.method}] ${originalReq.url} -> injected headers:`, {
        'x-user-id': newHeaders['x-user-id'] || 'NONE',
        'x-workspace-id': newHeaders['x-workspace-id'] || 'NONE',
        'x-user-role': newHeaders['x-user-role'] || 'NONE',
        'x-correlation-id': newHeaders['x-correlation-id']
      });

      return newHeaders;
    },
  };
};

export const registerProxyRoutes = (fastify: FastifyInstance) => {
  // --- PUBLIC ENDPOINTS ---
  
  // Gateway self-status
  fastify.get('/', async () => {
    return {
      status: 'ok',
      service: 'wapi-api-gateway',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  });

  // Health report (proxies to core server)
  fastify.get('/health', async (request, reply) => {
    return reply.from(`${config.coreServerUrl}/health`, getProxyOptions(request));
  });

  // Public authentication routes (login, sign-ups, OTP verifications)
  fastify.all('/api/v1/auth/*', async (request, reply) => {
    return reply.from(`${config.coreServerUrl}${request.url}`, getProxyOptions(request));
  });

  // Public webhook receivers (e.g. BSP/Gupshup callbacks)
  fastify.all('/api/webhooks/*', async (request, reply) => {
    return reply.from(`${config.coreServerUrl}${request.url}`, getProxyOptions(request));
  });

  // --- INTERNAL ROUTING FOR SERVICE-TO-SERVICE COMMUNICATION ---
  // Proxies internal microservice validations and hooks to the core server bypass boundaries
  fastify.all('/api/internal/*', async (request, reply) => {
    return reply.from(`${config.coreServerUrl}${request.url}`, getProxyOptions(request));
  });

  // --- PROTECTED MICROSERVICE ROUTING ---

  // Automation Service
  fastify.all(
    '/api/v1/automation/*',
    { preHandler: [authenticateGateway] },
    async (request, reply) => {
      const cleanPath = request.url.replace(/^\/api\/v1\/automation/, '/api/automation');
      return reply.from(`${config.automationServiceUrl}${cleanPath}`, getProxyOptions(request));
    }
  );

  // Campaign Service
  fastify.all(
    '/api/v1/campaign/*',
    { preHandler: [authenticateGateway] },
    async (request, reply) => {
      const cleanPath = request.url.replace(/^\/api\/v1\/campaign/, '/api/campaign');
      return reply.from(`${config.campaignServiceUrl}${cleanPath}`, getProxyOptions(request));
    }
  );

  // Billing Service
  fastify.all(
    '/api/v1/billing/*',
    { preHandler: [authenticateGateway] },
    async (request, reply) => {
      const cleanPath = request.url.replace(/^\/api\/v1\/billing/, '/api/billing');
      return reply.from(`${config.billingServiceUrl}${cleanPath}`, getProxyOptions(request));
    }
  );

  // --- CATCH-ALL ROUTING FOR THE CORE MONOLITH ---
  // Any other route under /api/v1 is resolved through core monolith 'server'
  fastify.all(
    '/api/v1/*',
    { preHandler: [authenticateGateway] },
    async (request, reply) => {
      return reply.from(`${config.coreServerUrl}${request.url}`, getProxyOptions(request));
    }
  );
};
