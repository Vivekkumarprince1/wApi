import 'dotenv/config.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import crypto from 'crypto';
// IMPORTANT: http-proxy-middleware v3's `createProxyMiddleware` strips the
// Express mount prefix from `req.url` BEFORE `pathRewrite` runs. Every
// pathRewrite in this gateway (and every downstream service, which mount their
// handlers on the *full* `/api/v1/...` paths) assumes the full original URL is
// present. `legacyCreateProxyMiddleware` restores `req.originalUrl` (the v2
// behaviour), so `pathRewrite` and stripPrefix work as written. Swapping the
// alias keeps the rest of this file unchanged.
import { legacyCreateProxyMiddleware as createProxyMiddleware } from 'http-proxy-middleware';
import { authRateLimit, apiRateLimit, bulkRateLimit } from './middleware/rateLimit.js';

const app = express();
const port = parseInt(process.env.BACKEND_PORT || process.env.PORT || "5001", 10);

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001"
];

// Helmet security policy
app.use(helmet());

// CORS config
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  credentials: true
}));

app.use(morgan('dev'));

// 1. Correlation ID, Header Stripping & Session Verification Middleware
// Generate or propagate x-correlation-id across all microservices requests
app.use(async (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || crypto.randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  // P0 SECURITY: Forcefully strip client-supplied gateway headers to prevent spoofing
  delete req.headers['x-user-id'];
  delete req.headers['x-user-role'];
  delete req.headers['x-user-system-role'];
  delete req.headers['x-workspace-id'];
  delete req.headers['x-permissions'];
  delete req.headers['x-impersonating'];
  delete req.headers['x-internal-service-secret'];

  // Skip verification for internal API calls or public health check endpoints
  if (req.path.startsWith('/api/internal') || req.path === '/health' || req.path === '/') {
    return next();
  }

  // Parse session token from Authorization header or auth_token cookie
  let token: string | undefined;
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (typeof req.headers['cookie'] === 'string') {
    const cookies = req.headers['cookie'].split(';').map(c => c.trim());
    const match = cookies.find(c => c.startsWith('auth_token='));
    if (match) {
      token = match.substring('auth_token='.length);
    }
  }

  if (token) {
    try {
      const authServiceUrl = SERVICES.auth;
      const verifyRes = await fetch(`${authServiceUrl}/internal/v1/auth/verify-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': String(correlationId),
        },
        body: JSON.stringify({ token }),
      });

      if (verifyRes.ok) {
        const verifyData = await verifyRes.json() as any;
        if (verifyData && verifyData.success) {
          const userId = verifyData.user?._id || verifyData.user?.id;
          const workspaceRole = verifyData.role || verifyData.workspace?.role || 'agent';
          const systemRole = verifyData.user?.role || 'user';
          const workspaceId = verifyData.workspace?._id || verifyData.workspace?.id || verifyData.user?.activeWorkspace || verifyData.user?.workspace;
          const permissions = Array.isArray(verifyData.permissions) ? verifyData.permissions : [];

          if (userId) {
            req.headers['x-user-id'] = String(userId);
          }
          req.headers['x-user-role'] = String(workspaceRole);
          req.headers['x-user-system-role'] = String(systemRole);
          req.headers['x-permissions'] = encodeURIComponent(JSON.stringify(permissions));
          req.headers['x-impersonating'] = verifyData.isImpersonating ? 'true' : 'false';
          if (workspaceId) {
            req.headers['x-workspace-id'] = String(workspaceId);
          }

          // Inject shared internal key to prove that these headers were set by API Gateway
          req.headers['x-internal-service-secret'] = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-change-me';
        }
      } else {
        console.error(`[API Gateway Session Verification Error]: Auth Service returned status ${verifyRes.status}`);
        res.status(502).json({
          success: false,
          error: 'Bad Gateway',
          message: 'The authentication service is currently offline or unreachable. Please try again shortly.'
        });
        return;
      }
    } catch (err: any) {
      console.error(`[API Gateway Session Verification Error]: ${err.message}`);
      res.status(502).json({
        success: false,
        error: 'Bad Gateway',
        message: 'The authentication service is currently unreachable.'
      });
      return;
    }
  }

  next();
});


// Define the Microservice URLs
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3006',
  contact: process.env.CONTACT_SERVICE_URL || 'http://localhost:3007',
  chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3008',
  bsp: process.env.BSP_SERVICE_URL || 'http://localhost:3004',
  automation: process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3005',
  billing: process.env.BILLING_SERVICE_URL || 'http://localhost:3003',
  campaign: process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:3002',
  websocket: process.env.WEBSOCKET_URL || 'http://localhost:3009',
  ingestor: process.env.WEBHOOK_INGESTOR_URL || 'http://localhost:3013',
};

// Standard Proxy Error Handler.
// NOTE: for WebSocket upgrade failures, http-proxy emits 'error' with a raw
// net.Socket as the third argument (not an HTTP response), so guard on writeHead
// to avoid "res.writeHead is not a function" crashing the gateway.
const handleProxyError = (serviceName: string) => (err: any, req: any, res: any) => {
  const correlationId = req?.headers?.['x-correlation-id'] || 'unknown';
  console.error(`[API Gateway Proxy Error] ${req?.method} ${req?.url} -> Failed to reach ${serviceName} service: ${err?.message} (Correlation ID: ${correlationId})`);
  if (!res || typeof res.writeHead !== 'function') {
    // WebSocket upgrade error: res is a net.Socket — just tear it down.
    try { res?.destroy?.(); } catch { /* noop */ }
    return;
  }
  res.writeHead(502, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: false,
    error: 'Bad Gateway',
    message: `The ${serviceName} service is currently offline or unreachable. Please try again shortly.`,
    correlationId,
  }));
};

// Create a proxy helper — strips the Express mount prefix so downstream
// services receive paths starting from "/" (e.g. /login, not /api/v1/auth/login)
// NOTE: these are HTTP-only proxies. We deliberately do NOT set `ws: true` here:
// http-proxy-middleware auto-subscribes every `ws:true` proxy to the server's
// 'upgrade' event with no path filtering, so each would try to proxy the
// /socket.io WebSocket upgrade to its own service. Only the dedicated socket.io
// proxy below handles upgrades.
const proxyTo = (target: string, serviceName: string, stripPrefix?: string) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    ...(stripPrefix ? { pathRewrite: { [`^${stripPrefix}`]: '' } } : {}),
    on: {
      error: handleProxyError(serviceName)
    }
  });
};

// Custom proxy to bridge /api/v1/workspace/waba -> /bsp/v1/workspace/waba
const proxyToBspWorkspace = (target: string) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => path.replace('/api/v1/workspace', '/bsp/v1/workspace'),
    on: {
      error: handleProxyError('bsp')
    }
  });
};

const proxyToBspOnboarding = (target: string) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    // /api/v1/onboarding/bsp/start -> /bsp/v1/onboarding/start
    pathRewrite: (path) => path.replace('/api/v1/onboarding/bsp', '/bsp/v1/onboarding'),
    on: {
      error: handleProxyError('bsp')
    }
  });
};

// Custom proxy to rewrite /api/v1/settings -> /settings
const proxyToSettings = (target: string) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => path.replace('/api/v1/settings', '/settings'),
    on: {
      error: handleProxyError('auth')
    }
  });
};

const proxyRewrite = (target: string, serviceName: string, rewrite: (path: string, req?: any) => string) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: rewrite,
    on: {
      error: handleProxyError(serviceName)
    }
  });
};

// --- Proxy Routes ---

// Apply general API rate limit to all routes
app.use('/api', apiRateLimit);

// 1. Auth Service
// Apply stricter authRateLimit specifically to auth/login/signup endpoints
app.use('/api/v1/auth', authRateLimit, proxyTo(SERVICES.auth, 'auth', '/api/v1/auth'));
app.use('/api/v1/super-admin', proxyRewrite(SERVICES.auth, 'auth', (path) => path.replace('/api/v1/super-admin', '/super-admin')));

// 2. Billing Service
// NOTE: /api/v1/workspace/billing MUST come before /api/v1/workspace so that
// billing requests are routed to the billing-service, not the auth-service.
app.use('/api/v1/workspace/billing', proxyTo(SERVICES.billing, 'billing', '/api/v1/workspace/billing'));
// Conversation pricing map lives in billing (workspace context from token).
app.use('/api/v1/workspace/pricing', proxyRewrite(
  SERVICES.billing,
  'billing',
  (path) => path.replace('/api/v1/workspace/pricing', '/pricing')
));

// 3. BSP Service (WABA workspace settings & onboarding)
// Specific WABA connections and settings must route to NestJS BSP service
app.use('/api/v1/workspace/tags', proxyTo(SERVICES.contact, 'contact'));
app.use('/api/v1/workspace/quick-replies', proxyTo(SERVICES.contact, 'contact'));
app.use('/api/v1/workspace/waba', proxyToBspWorkspace(SERVICES.bsp));
app.use('/api/v1/workspace/profile', proxyToBspWorkspace(SERVICES.bsp));
app.use('/api/v1/workspace/webhooks', proxyToBspWorkspace(SERVICES.bsp));
app.use('/api/v1/workspace/whatsapp/health', proxyToBspWorkspace(SERVICES.bsp));
app.use('/api/v1/workspace/phone-numbers', proxyToBspWorkspace(SERVICES.bsp));
app.use('/api/v1/workspace/connection-status', proxyToBspWorkspace(SERVICES.bsp));

// 4. Fallback Workspace routes go to Auth Service
app.use('/api/v1/workspace', proxyRewrite(SERVICES.auth, 'auth', (path) => path.replace('/api/v1/workspace', '/workspace')));

// 5. General Settings and Business profile mappings
app.use('/api/v1/settings/api-keys', proxyRewrite(
  SERVICES.automation,
  'automation',
  (path) => path.replace('/api/v1/settings/api-keys', '/keys')
));

app.use('/api/v1/settings/integrations', proxyRewrite(
  SERVICES.automation,
  'automation',
  (path) => path.replace('/api/v1/settings/integrations', '/api/v1/integrations')
));

app.use('/api/v1/settings/team', proxyRewrite(
  SERVICES.auth,
  'auth',
  (path) => path.replace('/api/v1/settings/team', '/workspace/members')
));

app.use('/api/v1/settings/notifications', proxyRewrite(
  SERVICES.auth,
  'auth',
  (path) => path.replace('/api/v1/settings/notifications', '/user/settings/notifications')
));

app.use('/api/v1/settings/workspace', proxyRewrite(
  SERVICES.auth,
  'auth',
  (path) => path.replace('/api/v1/settings/workspace', '/workspace/settings')
));

app.use('/api/v1/settings/billing', proxyRewrite(
  SERVICES.billing,
  'billing',
  (path, req) => {
    if (req?.method === 'GET') {
      return '/info';
    }
    return '/settings';
  }
));

app.use('/api/v1/settings', proxyRewrite(
  SERVICES.auth,
  'auth',
  (path) => path.replace('/api/v1/settings', '/workspace/settings')
));

app.use('/api/v1/business', proxyTo(SERVICES.auth, 'auth', '/api/v1/business'));

// Legacy compatibility routes that old frontend/components still call.
app.use('/api/v1/tags', proxyTo(SERVICES.contact, 'contact'));
app.use('/api/v1/messaging/quick-replies', proxyTo(SERVICES.contact, 'contact'));
// inbox/settings — workspace inbox configuration (auth-service owns workspace settings)
app.use('/api/v1/inbox/settings', proxyRewrite(
  SERVICES.auth,
  'auth',
  (path) => path.replace('/api/v1/inbox/settings', '/workspace/inbox/settings')
));

// 6. Contact Service
// Carve-out: sending a template to a contact is a messaging concern (chat-service
// owns conversations + dispatch). Must be registered before the generic /contacts mount.
app.use('/api/v1/contacts/:contactId/send-template', proxyRewrite(
  SERVICES.chat,
  'chat',
  (path) => path.replace('/api/v1/contacts/', '/api/v1/inbox/contacts/')
));
app.use('/api/v1/contacts', proxyTo(SERVICES.contact, 'contact'));
app.use('/api/v1/crm', proxyTo(SERVICES.contact, 'contact'));
app.use('/api/v1/bulk', bulkRateLimit, proxyTo(SERVICES.contact, 'contact'));

// 7. Chat/Inbox Service
app.use('/api/v1/inbox', proxyTo(SERVICES.chat, 'chat'));
app.use('/api/v1/conversations', proxyTo(SERVICES.chat, 'chat'));
app.use('/api/v1/analytics', proxyTo(SERVICES.chat, 'chat'));
app.use('/api/v1/metrics', proxyTo(SERVICES.chat, 'chat'));
app.use('/api/v1/support', proxyTo(SERVICES.chat, 'chat'));

// 8. Other Billing endpoints
app.use('/api/v1/billing', proxyRewrite(
  SERVICES.billing,
  'billing',
  (path) => path.replace('/api/v1/billing', '/api/billing/wallets')
));
app.use('/api/v1/commerce', proxyTo(SERVICES.billing, 'billing'));

// 9. Campaign and Marketing Service
app.use('/api/v1/campaign', proxyRewrite(
  SERVICES.campaign,
  'campaign',
  (path) => path.replace('/api/v1/campaign', '/api/campaign')
));
app.use('/api/v1/ads', proxyTo(SERVICES.campaign, 'campaign'));

// 10. Automation and Workflow Service
// automation-service mounts its engine routes at /api/automation/engine (no /v1),
// so rewrite /api/v1/automation -> /api/automation before proxying.
app.use('/api/v1/automation', proxyRewrite(
  SERVICES.automation,
  'automation',
  (path) => path.replace('/api/v1/automation', '/api/automation')
));
app.use('/api/v1/flows', proxyTo(SERVICES.automation, 'automation'));
app.use('/api/v1/widget', proxyTo(SERVICES.automation, 'automation'));
app.use('/api/v1/developer', proxyTo(SERVICES.automation, 'automation'));
app.use('/api/v1/integrations', proxyTo(SERVICES.automation, 'automation'));

// 11. BSP Onboarding and Templates
app.use('/api/v1/onboarding/bsp', proxyToBspOnboarding(SERVICES.bsp));
// bsp-service exposes onboarding under /bsp/v1/onboarding/* (e.g. /status, /complete)
app.use('/api/v1/onboarding', proxyRewrite(
  SERVICES.bsp,
  'bsp',
  (path) => path.replace('/api/v1/onboarding', '/bsp/v1/onboarding')
));
app.use('/api/v1/templates', proxyTo(SERVICES.bsp, 'bsp'));
app.use('/api/v1/upload', proxyTo(SERVICES.bsp, 'bsp'));

// 12. Internal Service Bridge Routing
app.use('/api/internal/billing', proxyRewrite(
  SERVICES.billing,
  'billing',
  (path) => path.replace('/api/internal/billing', '/api/billing')
));

app.use('/api/internal/contacts', proxyRewrite(
  SERVICES.contact,
  'contact',
  (path) => path.replace('/api/internal/contacts', '/internal/v1/contacts')
));

app.use('/api/internal/bsp', proxyRewrite(
  SERVICES.bsp,
  'bsp',
  (path) => path.replace('/api/internal/bsp', '/internal/v1/bsp')
));

app.use('/api/internal/chat', proxyRewrite(
  SERVICES.chat,
  'chat',
  (path) => path.replace('/api/internal/chat', '/api/internal')
));

app.use('/api/internal', proxyTo(SERVICES.chat, 'chat'));

// 13. Provider webhooks. Payment webhooks belong to billing; BSP/message
// provider webhooks belong to the ingestion edge.
app.use('/api/webhooks/razorpay', proxyRewrite(
  SERVICES.billing,
  'billing',
  (path) => path.replace('/api/webhooks', '/api/billing/webhooks')
));
app.use('/api/webhooks', proxyRewrite(
  SERVICES.ingestor,
  'webhook-ingestor',
  (path) => path.replace('/api/webhooks', '/webhooks')
));


// 13. Socket.io WebSocket Gateway — the ONLY proxy with `ws: true`, so it is the only
// one that handles HTTP "upgrade" events (socket.io is the only WebSocket here).
// We also wire server.on('upgrade') below: http-proxy-middleware only auto-subscribes
// after the first *HTTP* request reaches this mount, but socket.io clients try the
// `websocket` transport first (a raw upgrade that bypasses Express routing).
const wsProxy = createProxyMiddleware({
  target: SERVICES.websocket,
  changeOrigin: true,
  ws: true,
  on: {
    error: handleProxyError('websocket-gateway')
  }
});
app.use('/socket.io', wsProxy);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'wapi-api-gateway',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'wapi-api-gateway',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`\x1b[32m[API Gateway] Running at http://0.0.0.0:${port}\x1b[0m`);
  console.log(`[API Gateway] Proxying /api/v1/auth -> ${SERVICES.auth}`);
  console.log(`[API Gateway] Proxying /api/v1/contacts -> ${SERVICES.contact}`);
  console.log(`[API Gateway] Proxying /api/v1/inbox -> ${SERVICES.chat}`);
  console.log(`[API Gateway] Proxying /api/v1/billing -> ${SERVICES.billing}`);
  console.log(`[API Gateway] Proxying /api/v1/campaign -> ${SERVICES.campaign}`);
  console.log(`[API Gateway] Proxying /api/v1/automation -> ${SERVICES.automation}`);
  console.log(`[API Gateway] Proxying /api/v1/onboarding -> ${SERVICES.bsp}`);
  console.log(`[API Gateway] Proxying /socket.io (ws) -> ${SERVICES.websocket}`);
});

// Proxy WebSocket upgrades for socket.io to the websocket-gateway.
server.on('upgrade', (wsProxy as any).upgrade);
