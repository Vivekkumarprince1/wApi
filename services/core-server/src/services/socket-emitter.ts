import { Emitter } from "@socket.io/redis-emitter";
import Redis from "ioredis";

let emitter: Emitter | null = null;

/**
 * Initialize Socket Emitter
 * Used to send events to the Socket.io server from other processes.
 */
export const initSocketEmitter = async () => {
    try {
        const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        
        redisClient.on('error', (err) => {
            console.error("[SocketEmitter] Redis Error:", err);
        });

        emitter = new Emitter(redisClient);
        console.log("[SocketEmitter] Initialized with ioredis");
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
