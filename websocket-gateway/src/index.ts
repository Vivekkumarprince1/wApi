import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose, { Schema } from 'mongoose';
import { EachMessagePayload, Kafka } from 'kafkajs';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT || '3009', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Database connection
async function connectDb() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/wapi';
    mongoose.set('bufferCommands', false);
    await mongoose.connect(mongoUri);
    console.log(`[WebSocket Gateway] Connected to MongoDB`);
  } catch (err: any) {
    console.error(`[WebSocket Gateway] Database connection failed: ${err.message}`);
    process.exit(1);
  }
}

// Minimal Permission Schema for socket auth checks
const PermissionSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, required: true },
  user: { type: Schema.Types.ObjectId, required: true },
  isActive: { type: Boolean, default: true },
});
const Permission = mongoose.models.Permission || mongoose.model('Permission', PermissionSchema);

// Room Helpers
async function userIsWorkspaceMember(userId: string, workspaceId: string): Promise<boolean> {
  if (!userId || !workspaceId) return false;
  if (!mongoose.isValidObjectId(workspaceId)) return false;
  try {
    const membership = await Permission.findOne({
      user: new mongoose.Types.ObjectId(userId),
      workspace: new mongoose.Types.ObjectId(workspaceId),
      isActive: { $ne: false },
    });
    return !!membership;
  } catch (err) {
    return false;
  }
}

// --- SOCKET AUTH MIDDLEWARE ---
io.use(async (socket: any, next) => {
  try {
    let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    
    if (!token && socket.handshake.headers?.cookie) {
      const parsed = socket.handshake.headers.cookie
        .split(';')
        .map((p: string) => p.trim())
        .find((p: string) => p.startsWith('auth_token='));
      if (parsed) token = parsed.slice('auth_token='.length);
    }

    if (!token) {
      return next(new Error('Unauthorized: missing auth token'));
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.id) {
      return next(new Error('Unauthorized: invalid token'));
    }

    socket.userId = decoded.id;
    socket.isSuperAdmin = decoded.role === 'super_admin';
    console.log(`[WebSocket Gateway] Authenticated user: ${socket.userId}`);
    next();
  } catch (err: any) {
    next(new Error('Unauthorized: authentication failed'));
  }
});

// --- SOCKET CONNECTIONS & EVENTS ---
io.on('connection', (socket: any) => {
  console.log(`[WebSocket Gateway] Agent socket connected: ${socket.id}`);

  // Heartbeat ping
  socket.emit('server:ping', { status: 'OK', serverTime: new Date().toISOString() });

  // Join Workspace Room
  socket.on('workspace:join', async (data: { workspaceId: string }) => {
    const { workspaceId } = data;
    if (!workspaceId) return;

    const isMember = await userIsWorkspaceMember(socket.userId, workspaceId);
    if (!isMember && !socket.isSuperAdmin) {
      socket.emit('socket:error', { event: 'workspace:join', reason: 'forbidden' });
      return;
    }

    const workspaceRoom = `workspace:${workspaceId}`;
    socket.join(workspaceRoom);
    console.log(`[WebSocket Gateway] User joined workspace room: ${workspaceRoom}`);
    socket.to(workspaceRoom).emit('agent:online', { userId: socket.userId });
  });

  // Leave Workspace Room
  socket.on('workspace:leave', (data: { workspaceId: string }) => {
    const { workspaceId } = data;
    if (workspaceId) {
      socket.leave(`workspace:${workspaceId}`);
    }
  });

  // Join Conversation Details Room
  socket.on('conversation:join', async (data: { conversationId: string; workspaceId: string }) => {
    const { conversationId, workspaceId } = data;
    if (!conversationId || !workspaceId) return;

    const isMember = await userIsWorkspaceMember(socket.userId, workspaceId);
    if (!isMember && !socket.isSuperAdmin) {
      socket.emit('socket:error', { event: 'conversation:join', reason: 'forbidden' });
      return;
    }

    const conversationRoom = `conversation:${conversationId}`;
    socket.join(conversationRoom);
    console.log(`[WebSocket Gateway] User joined conversation room: ${conversationRoom}`);
  });

  // Leave Conversation Details Room
  socket.on('conversation:leave', (data: { conversationId: string }) => {
    const { conversationId } = data;
    if (conversationId) {
      socket.leave(`conversation:${conversationId}`);
    }
  });

  // Typing state propagation
  socket.on('typing', (data: { conversationId: string; workspaceId: string; isTyping: boolean }) => {
    const { conversationId, workspaceId, isTyping } = data;
    if (!conversationId || !workspaceId) return;

    const payload = { conversationId, isTyping, userId: socket.userId };
    socket.to(`conversation:${conversationId}`).emit('conversation:typing', payload);
    socket.to(`workspace:${workspaceId}`).emit('inbox:typing', payload);
  });

  socket.on('disconnect', () => {
    console.log(`[WebSocket Gateway] Socket disconnected: ${socket.id}`);
  });
});

// --- KAFKA SYNC CONSUMER ---
let kafkaConsumer: any = null;
let kafkaProducer: any = null;

async function processRealtimeSyncEvent(envelope: any) {
  const workspaceRoom = `workspace:${envelope.workspaceId}`;
  const conversationRoom = `conversation:${envelope.conversationId}`;

  // 1. Always emit generic inbox sync (fallback support)
  io.to(workspaceRoom).emit('inbox:sync', envelope);

  // 2. Map and emit exact frontend-compatible Socket.io events
  if (envelope.type === 'message_created') {
    const db = mongoose.connection.db;
    if (!db) {
      console.error('[WS Gateway Kafka] Database connection db object is missing.');
      return;
    }

    // Fetch Conversation and Contact to construct full inbox:message_new payload
    let contactPayload = envelope.contact || null;
    if (!contactPayload) {
      try {
        const conversation = await db.collection('conversations').findOne({
          _id: new mongoose.Types.ObjectId(envelope.conversationId),
        });

        if (conversation && conversation.contact) {
          const contact = await db.collection('contacts').findOne({
            _id: conversation.contact,
          });
          if (contact) {
            contactPayload = {
              _id: contact._id.toString(),
              name: contact.name || 'Unknown',
              phone: contact.phone || '',
            };
          }
        }
      } catch (dbErr: any) {
        console.error('[WS Gateway Kafka] MongoDB lookup error:', dbErr.message);
      }
    }

    const socketMsgPayload = {
      conversationId: envelope.conversationId,
      message: {
        ...envelope.payload,
        // Ensure front-end receives text as body/text interchangeably
        body: envelope.payload.text || envelope.payload.body || '',
      },
      contact: contactPayload,
    };

    // Emit frontend compatible new message event
    io.to(workspaceRoom).emit('inbox:message_new', socketMsgPayload);
    io.to(conversationRoom).emit('inbox:message_new', socketMsgPayload);

    // Also emit legacy compatibility events
    io.to(conversationRoom).emit('message:created', envelope.payload);
    console.log(`[WS Gateway Kafka] Broadcasted inbox:message_new for messageId: ${envelope.messageId}`);
  } 
  else if (envelope.type === 'message_status_updated' || envelope.type === 'message_status_changed') {
    const statusPayload = {
      messageId: envelope.payload.providerMessageId || envelope.payload.messageId || envelope.messageId,
      conversationId: envelope.payload.conversationId || envelope.conversationId,
      status: (envelope.payload.status || '').toLowerCase(),
      timestamp: envelope.payload.timestamp || envelope.timestamp,
    };

    io.to(workspaceRoom).emit('inbox:message_status', statusPayload);
    io.to(conversationRoom).emit('inbox:message_status', statusPayload);
    console.log(`[WS Gateway Kafka] Broadcasted inbox:message_status status: ${statusPayload.status}`);
  } 
  else if (envelope.type === 'conversation_status_changed') {
    const updatePayload = {
      conversationId: envelope.conversationId,
      status: envelope.payload.status,
      isOpen: envelope.payload.status === 'open',
      lastActivityAt: envelope.timestamp,
    };

    io.to(workspaceRoom).emit('inbox:conversation_updated', updatePayload);
    io.to(workspaceRoom).emit('conversation:updated', updatePayload);
    io.to(conversationRoom).emit('conversation:status-updated', envelope.payload);
    console.log(`[WS Gateway Kafka] Broadcasted inbox:conversation_updated status: ${updatePayload.status}`);
  }
}

async function processPlatformEvent(topic: string, envelope: any) {
  const workspaceId = envelope.workspaceId || envelope.payload?.workspaceId;
  if (!workspaceId) return;

  const workspaceRoom = `workspace:${workspaceId}`;
  io.to(workspaceRoom).emit('platform:event', { topic, ...envelope });

  if (topic === 'contact-events') {
    io.to(workspaceRoom).emit('contact:updated', envelope);
    io.to(workspaceRoom).emit('inbox:contact_updated', envelope);
  } else if (topic === 'automation-events') {
    io.to(workspaceRoom).emit('automation:event', envelope);
    io.to(workspaceRoom).emit('automation:execution_update', envelope);
  } else if (topic === 'billing-events') {
    io.to(workspaceRoom).emit('billing:event', envelope);
    if (envelope.event === 'wallet_recharged') {
      io.to(workspaceRoom).emit('wallet:recharged', envelope.payload);
    }
  } else if (topic === 'campaign-events' || topic === 'billing-events') {
    io.to(workspaceRoom).emit('campaign:event', envelope);
  }
}

async function initKafka() {
  try {
    const kafka = new Kafka({
      clientId: 'wapi-websocket-gateway',
      brokers: [KAFKA_BROKER],
      connectionTimeout: 3000,
    });

    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();

    kafkaConsumer = kafka.consumer({ groupId: 'wapi-websocket-gateway-group' });
    await kafkaConsumer.connect();
    for (const topic of ['chat-realtime-sync', 'contact-events', 'automation-events', 'billing-events', 'campaign-events']) {
      await kafkaConsumer.subscribe({ topic, fromBeginning: false });
    }

    await kafkaConsumer.run({
      eachMessage: async ({ topic, partition, message }: any) => {
        const value = message.value?.toString();
        if (!value) return;

        const maxRetries = 3;
        let attempt = 0;
        let success = false;
        let lastError: any = null;

        while (attempt < maxRetries && !success) {
          try {
            attempt++;
            const envelope = JSON.parse(value);
            console.log(`[WS Gateway Kafka] Event ingested. Topic: ${topic}, Type: ${envelope.type || envelope.event}, workspaceId: ${envelope.workspaceId}, attempt: ${attempt}`);
            if (topic === 'chat-realtime-sync') {
              await processRealtimeSyncEvent(envelope);
            } else {
              await processPlatformEvent(topic, envelope);
            }
            success = true;
          } catch (err: any) {
            lastError = err;
            console.error(`[WS Gateway Kafka] Attempt ${attempt} failed:`, err.message);
            if (attempt < maxRetries) {
              const delay = Math.pow(2, attempt) * 1000;
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        }

        if (!success) {
          console.error(`[WS Gateway Kafka] Sync broadcast failed after ${maxRetries} attempts. Publishing to DLQ...`);
          try {
            const dlqTopic = `${topic}-dlq`;
            await kafkaProducer.send({
              topic: dlqTopic,
              messages: [{
                key: message.key,
                value: message.value,
                headers: {
                  ...message.headers,
                  'x-dead-letter-reason': Buffer.from(lastError?.message || 'unknown'),
                  'x-dead-letter-attempts': Buffer.from(String(maxRetries)),
                }
              }]
            });
            console.log(`[WS Gateway Kafka] Successfully published dead letter to ${dlqTopic}`);
          } catch (dlqErr: any) {
            console.error('[WS Gateway Kafka] Failed to publish dead letter to DLQ:', dlqErr.message);
          }
        }
      },
    });

    console.log(`[WS Gateway Kafka] Successfully subscribed to topic "chat-realtime-sync"`);
  } catch (error: any) {
    console.warn(`[WS Gateway Kafka] Failed to connect to Kafka Broker: ${error.message}. Running in local isolation.`);
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'wapi-websocket-gateway' });
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function initRedisAdapter() {
  try {
    const pubClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    const subClient = pubClient.duplicate();
    
    pubClient.on('error', (err: Error) => console.error('[WebSocket Gateway Redis] Pub client error:', err));
    subClient.on('error', (err: Error) => console.error('[WebSocket Gateway Redis] Sub client error:', err));
    
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[WebSocket Gateway] Redis Adapter connected successfully');
  } catch (err: any) {
    console.warn(`[WebSocket Gateway] Failed to connect to Redis Adapter: ${err.message}. Running in local memory adapter.`);
  }
}

async function start() {
  await connectDb();
  await initRedisAdapter();
  await initKafka();
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[WebSocket Gateway] Running at http://localhost:${PORT}`);
  });
}

start();
