import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import replyFrom from '@fastify/reply-from';
import websocketPlugin from '@fastify/websocket';
import WebSocket from 'ws';
import crypto from 'crypto';
import { config } from './config';
import { registerProxyRoutes } from './routes/proxy';

function fingerprint(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 8);
}

const start = async () => {
  console.log(`[API Gateway] JWT_SECRET fingerprint: ${fingerprint(config.jwtSecret)}`);
  console.log(`[API Gateway] INTERNAL_SERVICE_SECRET fingerprint: ${fingerprint(config.internalServiceSecret)}`);

  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    // Allows larger payloads if needed, consistent with standard gateways
    bodyLimit: 10485760 * 5, // 50MB limit
  });

  // --- CORE MIDDLEWARES ---

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Turn off CSP if frontend is served separately
  });

  // CORS support
  await fastify.register(cors, {
    origin: config.allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Register reply-from for robust stream-based HTTP proxying.
  // `bodyLimit` and `undici.headersTimeout` cap how long the gateway
  // will wait on a slow upstream — without this, a hung billing-service
  // would tie up gateway connections indefinitely.
  const UPSTREAM_TIMEOUT_MS = Number(process.env.GATEWAY_UPSTREAM_TIMEOUT_MS || 8000);
  await fastify.register(replyFrom, {
    undici: {
      connections: 100,
      pipelining: 10,
      headersTimeout: UPSTREAM_TIMEOUT_MS,
      bodyTimeout: UPSTREAM_TIMEOUT_MS,
    },
  });

  // Register websocket plugin
  await fastify.register(websocketPlugin);

  // --- WEBSOCKET & HTTP PROXY FOR SOCKET.IO ---
  // Integrates both WebSocket upgrades and standard HTTP GET polling seamlessly
  fastify.route({
    method: 'GET',
    url: '/socket.io/*',
    // Standard HTTP GET fallback handler (polling phase)
    handler: async (request, reply) => {
      return reply.from(`${config.coreServerUrl}${request.url}`, {
        rewriteRequestHeaders: (originalReq, headers) => {
          const newHeaders = { ...headers };
          newHeaders['x-internal-service-secret'] = config.internalServiceSecret;
          return newHeaders;
        },
      });
    },
    // WebSocket upgrades handler
    wsHandler: (connection, request) => {
      const backendWsUrl = config.coreServerUrl.replace(/^http/, 'ws') + request.url;
      
      fastify.log.debug(`[Gateway WS Proxy] Connecting to core websocket service: ${backendWsUrl}`);

      const backendSocket = new WebSocket(backendWsUrl, {
        headers: {
          cookie: request.headers.cookie || '',
          'user-agent': request.headers['user-agent'] || '',
          'x-correlation-id': (request.headers['x-correlation-id'] as string) || '',
          'x-internal-service-secret': config.internalServiceSecret,
        },
      });

      // Client -> Backend
      connection.socket.on('message', (message, isBinary) => {
        if (backendSocket.readyState === WebSocket.OPEN) {
          backendSocket.send(message, { binary: isBinary });
        }
      });

      // Backend -> Client
      backendSocket.on('message', (message, isBinary) => {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(message, { binary: isBinary });
        }
      });

      // Close synchronization
      connection.socket.on('close', () => {
        fastify.log.debug('[Gateway WS Proxy] Client socket closed, closing backend socket.');
        backendSocket.close();
      });

      backendSocket.on('close', () => {
        fastify.log.debug('[Gateway WS Proxy] Backend socket closed, closing client socket.');
        connection.socket.close();
      });

      // Error handling
      connection.socket.on('error', (err) => {
        fastify.log.error(`[Gateway WS Proxy] Client socket error: ${err.message}`);
        backendSocket.close();
      });

      backendSocket.on('error', (err) => {
        fastify.log.error(`[Gateway WS Proxy] Backend socket error: ${err.message}`);
        connection.socket.close();
      });
    }
  });

  // Handle Socket.io HTTP polling POST requests
  fastify.post('/socket.io/*', async (request, reply) => {
    return reply.from(`${config.coreServerUrl}${request.url}`, {
      rewriteRequestHeaders: (originalReq, headers) => {
        const newHeaders = { ...headers };
        newHeaders['x-internal-service-secret'] = config.internalServiceSecret;
        return newHeaders;
      },
    });
  });

  // --- REGISTER PROXY ROUTES ---
  registerProxyRoutes(fastify);

  // --- START SERVER ---
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 API Gateway is running at http://0.0.0.0:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
