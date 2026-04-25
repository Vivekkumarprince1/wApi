import { Emitter } from "@socket.io/redis-emitter";
import IORedis from "ioredis";

/**
 * SOCKET EMITTER
 * Allows background workers running in separate processes/containers
 * to broadcast real-time events to connected clients via Redis.
 */

let emitter: Emitter | null = null;

export const getSocketEmitter = () => {
  if (emitter) return emitter;

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const redisClient = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  emitter = new Emitter(redisClient);
  console.log("[SocketEmitter] Redis Emitter initialized");
  return emitter;
};

/**
 * Standardized Broadcast Helpers
 */

export const broadcastToWorkspace = (workspaceId: string, event: string, payload: any) => {
  const e = getSocketEmitter();
  e.to(`workspace:${workspaceId}`).emit(event, payload);
};

export const broadcastToConversation = (conversationId: string, event: string, payload: any) => {
  const e = getSocketEmitter();
  e.to(`conversation:${conversationId}`).emit(event, payload);
};

export const broadcastToUser = (userId: string, event: string, payload: any) => {
  const e = getSocketEmitter();
  e.to(`user:${userId}`).emit(event, payload);
};
