import IORedis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { config } from '../config';

/**
 * Microservice Event Bridge
 * 
 * Listens to Redis Pub/Sub channels from microservices and broadcasts 
 * them to Socket.io clients in the correct workspace rooms.
 */
export class MicroserviceEventBridge {
  private subClient: IORedis;
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.subClient = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
    });
  }

  async start() {
    // Subscribe to all relevant microservice channels
    const channels = [
      'automation:events',
      'campaign:events',
      'billing:events',
      'system:events'
    ];

    await this.subClient.subscribe(...channels);
    console.log(`[EventBridge] Subscribed to channels: ${channels.join(', ')}`);

    this.subClient.on('message', (channel, message) => {
      try {
        const eventData = JSON.parse(message);
        this.handleEvent(channel, eventData);
      } catch (error) {
        console.error(`[EventBridge] Error parsing message from ${channel}:`, error);
      }
    });

    this.subClient.on('error', (err) => {
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

    // Clients join `workspace:${workspaceId}` in socketHandler.ts; the
    // bridge MUST broadcast to the same room name or events will be dropped.
    const room = `workspace:${workspaceId}`;
    this.io.to(room).emit(event, payload);

    this.io.to(room).emit('microservice_event', {
      service: channel.split(':')[0],
      event,
      payload
    });
  }

  async stop() {
    await this.subClient.quit();
    console.log('[EventBridge] Stopped.');
  }
}
