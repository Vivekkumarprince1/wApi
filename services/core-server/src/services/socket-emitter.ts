import { Emitter } from "@socket.io/redis-emitter";
import { getSharedConnection } from '../utils/ioredis';

let emitter: Emitter | null = null;

/**
 * Initialize Socket Emitter
 * Used to send events to the Socket.io server from other processes.
 */
export const initSocketEmitter = async () => {
    try {
        const redisClient = getSharedConnection();
        emitter = new Emitter(redisClient as any);
        console.log("[SocketEmitter] Initialized with shared ioredis");
    } catch (error) {
        console.error("[SocketEmitter] Failed to initialize:", error);
    }
};

/**
 * Get Emitter Instance
 */
export const getSocketEmitter = (): Emitter => {
    if (!emitter) {
        throw new Error("Socket Emitter not initialized. Call initSocketEmitter first.");
    }
    return emitter;
};

/**
 * Emit Event to Workspace
 */
export const emitToWorkspace = (workspaceId: string, event: string, data: any) => {
    try {
        const io = getSocketEmitter();
        io.to(`workspace:${workspaceId}`).emit(event, data);
    } catch (error) {
        console.warn("[SocketEmitter] Could not emit event:", error);
    }
};
