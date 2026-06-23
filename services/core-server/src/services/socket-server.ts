import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { bullmqConnectionOptions, resolveRedisUrl } from '@wapi/contracts';
import { User, Permission, Conversation } from '../models';
import { setIO } from './socket-bridge';
import { getSharedConnection } from '../utils/ioredis';

const { Server } = require('socket.io') as { Server: any };
type SocketIOServer = any;

// Microservice Event Bridge
// Listens to standard Redis Pub/Sub channels from other microservices
// and broadcasts them to Socket.io clients in the correct workspace rooms.
class MicroserviceEventBridge {
  private subRedis: Redis;
  private ioServer: SocketIOServer;

  constructor(ioServer: SocketIOServer) {
    this.ioServer = ioServer;
    const redisUrl = resolveRedisUrl();
    this.subRedis = new Redis(redisUrl, bullmqConnectionOptions());
    this.subRedis.on('error', (err) => {
      console.error('[EventBridge] Redis Subscription Error:', err);
    });
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

// Helper functions for direct database query verification
async function verifyWorkspaceMembership(userId: string, workspaceId: string): Promise<boolean> {
  try {
    const membership = await Permission.findOne({
      user: userId,
      workspace: workspaceId,
      isActive: { $ne: false },
    }).lean();
    return !!membership;
  } catch (err: any) {
    console.error(`[Socket verifyWorkspaceMembership] Error checking membership:`, err.message);
    return false;
  }
}

async function verifyConversationAccess(userId: string, conversationId: string): Promise<boolean> {
  try {
    const convo: any = await Conversation.findById(conversationId).select('workspace').lean();
    if (!convo || !convo.workspace) {
      return false;
    }
    const membership = await Permission.findOne({
      user: userId,
      workspace: convo.workspace,
      isActive: { $ne: false },
    }).lean();
    return !!membership;
  } catch (err: any) {
    console.error(`[Socket verifyConversationAccess] Error checking access:`, err.message);
    return false;
  }
}

export function initSocketServer(httpServer: any) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001"
  ];

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST"]
    },
    transports: ["websocket", "polling"],
    allowEIO3: true
  });

  const pubClient = getSharedConnection();
  const redisUrl = resolveRedisUrl();
  const subClient = new Redis(redisUrl, bullmqConnectionOptions());
  subClient.on('error', (err) => {
    console.error('[Redis SubClient] Error:', err.message || err);
  });

  io.adapter(createAdapter(pubClient as any, subClient));

  // Shared bridge initialization
  setIO(io);

  // Socket Authentication Middleware
  io.use(async (socket: any, next: any) => {
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
        const jwtSecret = process.env.JWT_SECRET || 'dev-only-insecure-key-change-me';
        decoded = jwt.verify(token, jwtSecret);
      } catch (jwtErr: any) {
        console.warn(`[Socket Auth] Invalid token for socket ${socket.id}: ${jwtErr.message}`);
        return next(new Error('Unauthorized: invalid token'));
      }

      if (!decoded?.id) {
        return next(new Error('Unauthorized: token missing user id'));
      }

      // Fetch user details from DB directly (No loopback HTTP requests)
      const user = await User.findById(decoded.id).select('-passwordHash').lean();

      if (!user) {
        return next(new Error('Unauthorized: user not found'));
      }

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

  // Start standard Redis event bridge
  const eventBridge = new MicroserviceEventBridge(io);
  eventBridge.start().catch((err) => {
    console.error('❌ Failed to start standard Redis EventBridge:', err.message);
  });

  console.log('[SocketServer] Socket.io server initialized and attached to httpServer');
  return io;
}
