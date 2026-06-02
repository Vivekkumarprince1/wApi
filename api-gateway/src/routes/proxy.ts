import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticateGateway } from '../middlewares/auth';
import { config } from '../config';
import { normalizeRole } from '@wapi/contracts';

/**
 * Headers that the gateway controls authoritatively. We strip them off
 * the inbound request before we copy the rest forward, so a malicious
 * client cannot spoof identity by setting them itself.
 */
const STRIPPED_INBOUND_HEADERS = new Set([
  'x-user-id',
  'x-workspace-id',
  'x-user-role',
  'x-user-impersonating',
  'x-internal-service-secret',
  // hop-by-hop / connection-specific headers — never forward
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

// Upstream timeout is enforced at the @fastify/reply-from register
// site via undici's headersTimeout/bodyTimeout. We keep no per-call
// option here so we don't silently rely on an option name that isn't
// supported on this version of the plugin.

const getProxyOptions = (req: FastifyRequest) => {
  return {
    rewriteRequestHeaders: (_originalReq: any, headers: any) => {
      const incomingCorrelation = headers['x-correlation-id'];
      const correlationId =
        (typeof incomingCorrelation === 'string' && incomingCorrelation) ||
        `corr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      const newHeaders: Record<string, string> = {};

      // Copy non-sensitive headers forward. Drop anything we control or
      // any hop-by-hop header.
      for (const key of Object.keys(headers)) {
        const lower = key.toLowerCase();
        if (STRIPPED_INBOUND_HEADERS.has(lower)) continue;
        if (headers[key] === undefined) continue;
        newHeaders[lower] = String(headers[key]);
      }

      // Inject secure boundary credentials authoritatively.
      newHeaders['x-internal-service-secret'] = config.internalServiceSecret;
      newHeaders['x-correlation-id'] = correlationId;

      // Inject user/workspace context if resolved statelessly. We
      // always send x-user-id / x-workspace-id (empty string when
      // missing) so the downstream service can distinguish "no value"
      // from "header never made it". x-user-role we only set when the
      // JWT actually carried one — keeps the downstream `gatewayRole ||
      // 'agent'` fallback intact for legacy tokens.
      if (req.user) {
        newHeaders['x-user-id'] = req.user.id || '';
        newHeaders['x-workspace-id'] = req.user.workspaceId || '';
        if (req.user.role) {
          newHeaders['x-user-role'] = normalizeRole(req.user.role);
        }
        newHeaders['x-user-impersonating'] = String(!!req.user.isImpersonating);
      }

      return newHeaders;
    },
  };
};

export const registerProxyRoutes = (fastify: FastifyInstance) => {
  // Echo correlation id on every response. Adds correlation discipline
  // without forcing every handler to set it manually.
  fastify.addHook('onSend', async (request, reply, payload) => {
    const corr = (request.headers['x-correlation-id'] as string) || undefined;
    if (corr && !reply.getHeader('x-correlation-id')) {
      reply.header('x-correlation-id', corr);
    }
    return payload;
  });

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

  fastify.get('/live', async () => ({
    status: 'ok',
    service: 'wapi-api-gateway',
    uptime: process.uptime(),
  }));

  fastify.get('/ready', async (request, reply) => {
    return reply.from(`${config.coreServerUrl}/ready`, getProxyOptions(request));
  });

  fastify.get('/metrics', async (_request, reply) => {
    const mem = process.memoryUsage();
    const lines = [
      `# HELP process_uptime_seconds Process uptime`,
      `# TYPE process_uptime_seconds gauge`,
      `process_uptime_seconds ${process.uptime()}`,
      `# HELP process_resident_memory_bytes RSS memory`,
      `# TYPE process_resident_memory_bytes gauge`,
      `process_resident_memory_bytes ${mem.rss}`,
      `# HELP process_heap_used_bytes V8 heap used`,
      `# TYPE process_heap_used_bytes gauge`,
      `process_heap_used_bytes ${mem.heapUsed}`,
    ];
    reply.type('text/plain').send(lines.join('\n') + '\n');
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
