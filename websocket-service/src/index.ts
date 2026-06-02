import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import axios from 'axios';
import { config } from './config';
import { assertRedisPolicy, bullmqConnectionOptions } from '@wapi/contracts';

const app = express();
app.use(cors({
  origin: config.allowedOrigins,
  credentials: true
}));

// Basic Health Check Endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'wapi-websocket-service',
    timestamp: new Date().toISOString()
  });
});

app.get('/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'wapi-websocket-service', uptime: process.uptime() });
});

app.get('/ready', async (_req: Request, res: Response) => {
  let redisOk = false;
  try {
    redisOk = (await pubClient.ping()) === 'PONG';
  } catch {
    redisOk = false;
  }
  res.status(redisOk ? 200 : 503).json({
    status: redisOk ? 'ready' : 'not_ready',
    service: 'wapi-websocket-service',
    redis: redisOk ? 'ok' : 'down',
  });
});

app.get('/metrics', (_req: Request, res: Response) => {
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
  res.type('text/plain').send(lines.join('\n') + '\n');
});

const httpServer = createServer(app);

// Initialize Redis Pub/Sub client for Socket.io scaling
const pubClient = new Redis(config.redisUrl, bullmqConnectionOptions());
const subClient = pubClient.duplicate();

// Validate Redis policy once. Fails fast in production.
assertRedisPolicy({
  client: pubClient as any,
  service: 'websocket-service',
}).catch((err) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[websocket-service] fatal redis policy error:', err?.message || err);
    process.exit(1);
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: config.allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"],
  allowEIO3: true
});

io.adapter(createAdapter(pubClient, subClient));

/**
 * Microservice Event Bridge
 * 
 * Listens to standard Redis Pub/Sub channels from other microservices 
 * and broadcasts them to Socket.io clients in the correct workspace rooms.
 */
class MicroserviceEventBridge {
  private subRedis: Redis;
  private ioServer: Server;

  constructor(ioServer: Server) {
    this.ioServer = ioServer;
    this.subRedis = new Redis(config.redisUrl, bullmqConnectionOptions());
  }

  async start() {
    const channels = [
      'automation:events',
      'campaign:events',
      'billing:events',
      'system:events'
    ];

    await this.subRedis.subscribe(...channels);
    console.log(`[EventBridge] Subscribed to Redis channels: ${channels.join(', ')}`);

    this.subRedis.on('message', (channel, message) => {
      try {
        const eventData = JSON.parse(message);
        this.handleEvent(channel, eventData);
      } catch (error) {
        console.error(`[EventBridge] Error parsing message from ${channel}:`, error);
      }
    });

    this.subRedis.on('error', (err) => {
      console.error('[EventBridge] Redis Subscription Error:', err);
    });
  }

  private handleEvent(channel: string, data: any) {
    const { event, workspaceId, payload } = data;

    if (!event || !workspaceId) {
      console.warn(`[EventBridge] Received malformed event on ${channel}:`, data);
      return;
    }

    console.log(`[EventBridge][${workspaceId}] Relaying event: ${event}`);

    const room = `workspace:${workspaceId}`;
    this.ioServer.to(room).emit(event, payload);

    this.ioServer.to(room).emit('microservice_event', {
      service: channel.split(':')[0],
      event,
      payload
    });
  }

  async stop() {
    await this.subRedis.quit();
    console.log('[EventBridge] Stopped.');
  }
}

// Utility to parse cookies
function parseCookie(cookieStr: string, key: string): string | null {
  if (!cookieStr) return null;
  return (
    cookieStr
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${key}=`))
      ?.slice(`${key}=`.length) || null
  );
}

// Socket Authentication Middleware
io.use(async (socket: any, next) => {
  try {
    let token: string | null = null;
    let tokenSource = '';

    // 1. Handshake auth payload
    if (socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
      tokenSource = 'auth payload';
    }
    // 2. Authorization header
    else if (socket.handshake.headers.authorization) {
      token = socket.handshake.headers.authorization.split(' ')[1];
      tokenSource = 'Authorization header';
    }
    // 3. Cookies
    else if (socket.handshake.headers.cookie) {
      token = parseCookie(socket.handshake.headers.cookie, 'auth_token');
      if (token) tokenSource = 'Cookie (handshake headers)';
    }

    if (!token && socket.request.headers.cookie) {
      token = parseCookie(socket.request.headers.cookie as string, 'auth_token');
      if (token) tokenSource = 'Cookie (request headers)';
    }

    if (!token) {
      console.warn(`[Socket Auth] No auth token found for socket ${socket.id}`);
      return next(new Error('Unauthorized: missing auth token'));
    }

    console.log(`[Socket Auth] Token found from: ${tokenSource} (Socket: ${socket.id})`);

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (jwtErr: any) {
      console.warn(`[Socket Auth] Invalid token for socket ${socket.id}: ${jwtErr.message}`);
      return next(new Error('Unauthorized: invalid token'));
    }

    if (!decoded?.id) {
      return next(new Error('Unauthorized: token missing user id'));
    }

    // Fetch user details from Core Server internally
    const userResponse = await axios.get(`${config.coreServerUrl}/api/internal/verify/user/${decoded.id}`, {
      headers: {
        'x-internal-service-secret': config.internalServiceSecret
      }
    });

    if (!userResponse.data || !userResponse.data.user) {
      return next(new Error('Unauthorized: user not found'));
    }

    const user = userResponse.data.user;
    console.log(`[Socket Auth] Authenticated as ${user.email} (Socket: ${socket.id})`);
    socket.user = user;

    // Join the workspace room immediately if member
    const wsId = user.activeWorkspace || user.workspace;
    if (wsId) {
      const isMember = await verifyWorkspaceMembership(String(user._id), String(wsId));
      if (isMember || user.role === 'super_admin') {
        socket.join(`workspace:${String(wsId)}`);
        console.log(`[Socket Auth] Joined workspace room: workspace:${String(wsId)}`);
      }
    }

    next();
  } catch (err: any) {
    console.error('[Socket Auth] Unexpected auth error:', err.message);
    next(new Error('Unauthorized: internal error'));
  }
});

// Helper functions for calling core-server verification endpoints
async function verifyWorkspaceMembership(userId: string, workspaceId: string): Promise<boolean> {
  try {
    const res = await axios.get(`${config.coreServerUrl}/api/internal/verify/workspace-member`, {
      params: { userId, workspaceId },
      headers: { 'x-internal-service-secret': config.internalServiceSecret }
    });
    return !!res.data?.isMember;
  } catch (err: any) {
    console.error(`[Socket verifyWorkspaceMembership] Error checking membership:`, err.message);
    return false;
  }
}

async function verifyConversationAccess(userId: string, conversationId: string): Promise<boolean> {
  try {
    const res = await axios.get(`${config.coreServerUrl}/api/internal/verify/conversation-member`, {
      params: { userId, conversationId },
      headers: { 'x-internal-service-secret': config.internalServiceSecret }
    });
    return !!res.data?.hasAccess;
  } catch (err: any) {
    console.error(`[Socket verifyConversationAccess] Error checking access:`, err.message);
    return false;
  }
}

io.on('connection', (socket: any) => {
  console.log(`[Socket] Connected: ${socket.id} (User: ${socket.user?.email})`);

  // Heartbeat / ping
  socket.emit('server:ping', { status: 'OK', serverTime: new Date().toISOString() });

  // Join user-specific room
  if (socket.user?._id) {
    const userRoom = `user:${socket.user._id.toString()}`;
    socket.join(userRoom);
    console.log(`[Socket] Joined user room: ${userRoom}`);
  }

  // Handle workspace:join
  socket.on('workspace:join', async (data: { workspaceId: string }) => {
    const { workspaceId } = data || {};
    if (!workspaceId) return;

    if (!socket.user?._id) {
      console.warn(`[Socket] Refused workspace:join — unauthenticated socket ${socket.id}`);
      socket.emit('socket:error', { event: 'workspace:join', reason: 'unauthenticated' });
      return;
    }

    const isMember = await verifyWorkspaceMembership(socket.user._id, String(workspaceId));
    if (!isMember && socket.user?.role !== 'super_admin') {
      console.warn(`[Socket] Refused workspace:join for ${socket.user.email} → ${workspaceId}`);
      socket.emit('socket:error', { event: 'workspace:join', reason: 'forbidden', workspaceId });
      return;
    }

    const workspaceRoom = `workspace:${String(workspaceId)}`;
    socket.join(workspaceRoom);
    console.log(`[Socket] ${socket.user.email} joined ${workspaceRoom}`);

    socket.to(workspaceRoom).emit('agent:online', {
      userId: socket.user._id,
      name: socket.user.name,
      email: socket.user.email,
    });
  });

  // Handle workspace:leave
  socket.on('workspace:leave', (data: { workspaceId: string }) => {
    const { workspaceId } = data || {};
    if (workspaceId) {
      const workspaceRoom = `workspace:${workspaceId}`;
      socket.leave(workspaceRoom);
      console.log(`[Socket] ${socket.user?.email || 'Unknown'} left ${workspaceRoom}`);
    }
  });

  // Handle conversation:join
  socket.on('conversation:join', async (data: { conversationId: string }) => {
    const { conversationId } = data || {};
    if (!conversationId) return;

    if (!socket.user?._id) {
      console.warn(`[Socket] Refused conversation:join — unauthenticated socket ${socket.id}`);
      socket.emit('socket:error', { event: 'conversation:join', reason: 'unauthenticated' });
      return;
    }

    const allowed = socket.user?.role === 'super_admin' || 
                    await verifyConversationAccess(socket.user._id, String(conversationId));
    if (!allowed) {
      console.warn(`[Socket] Refused conversation:join for ${socket.user.email} → ${conversationId}`);
      socket.emit('socket:error', { event: 'conversation:join', reason: 'forbidden', conversationId });
      return;
    }

    const conversationRoom = `conversation:${String(conversationId)}`;
    socket.join(conversationRoom);
    console.log(`[Socket] ${socket.user.email} joined ${conversationRoom}`);

    socket.to(conversationRoom).emit('conversation:user-joined', {
      conversationId,
      user: { _id: socket.user._id, name: socket.user.name },
    });
  });

  // Handle conversation:leave
  socket.on('conversation:leave', (data: { conversationId: string }) => {
    const { conversationId } = data || {};
    if (conversationId) {
      const conversationRoom = `conversation:${conversationId}`;
      socket.leave(conversationRoom);
      console.log(`[Socket] ${socket.user?.email || 'Unknown'} left ${conversationRoom}`);

      socket.to(conversationRoom).emit('conversation:user-left', {
        conversationId,
        user: socket.user ? { _id: socket.user._id, name: socket.user.name } : null,
      });
    }
  });

  // Handle typing indicator
  socket.on('typing', (data: any) => {
    const { conversationId, isTyping = true } = data || {};
    if (!conversationId) return;

    const payload = {
      conversationId,
      agent: socket.user ? { _id: socket.user._id, name: socket.user.name } : null,
      isTyping,
    };

    socket.to(`conversation:${conversationId}`).emit('conversation:typing', payload);

    if (socket.user?.activeWorkspace || socket.user?.workspace) {
      const wsId = socket.user.activeWorkspace || socket.user.workspace;
      socket.to(`workspace:${wsId}`).emit('inbox:typing', payload);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    if (socket.user?.activeWorkspace || socket.user?.workspace) {
      const wsId = socket.user.activeWorkspace || socket.user.workspace;
      socket.to(`workspace:${wsId}`).emit('agent:offline', {
        userId: socket.user?._id,
        name: socket.user?.name,
      });
    }
  });
});

pubClient.on('error', (err) => console.error('[Redis PubClient] Error:', err.message));
subClient.on('error', (err) => console.error('[Redis SubClient] Error:', err.message));

// Start standard Redis event bridge
const eventBridge = new MicroserviceEventBridge(io);
eventBridge.start().catch((err) => {
  console.error('❌ Failed to start standard Redis EventBridge:', err.message);
});

httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 Standalone WS Service running on port ${config.port}`);
});
