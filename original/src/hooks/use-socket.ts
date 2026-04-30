"use client";

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth-store';
import { config as appConfig } from '@/lib/config';

/**
 * SINGLETON SOCKET INSTANCE
 * Ensures one connection across the entire dashboard
 */
let globalSocket: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;

interface SocketOptions {
  workspaceId?: string;
  conversationId?: string;
}

const normalizeRoomId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const maybeId = (value as any)?._id;
    if (typeof maybeId === 'string') return maybeId;
  }

  if (typeof (value as any)?.toString === 'function') {
    const normalized = (value as any).toString();
    if (normalized && normalized !== '[object Object]') return normalized;
  }

  return null;
};

const getSocket = async (token?: string): Promise<Socket> => {
  // If already connected, return it
  if (globalSocket?.connected) return globalSocket;
  // If connection is in progress, return the existing promise
  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise((resolve, reject) => {
    const socketBase =
      (typeof window !== 'undefined' && window.location?.origin) ||
      appConfig.socketUrl;

    console.log('[Socket:Singleton] Connecting to:', socketBase);

    const socket = io(socketBase, {
      auth: token ? { token } : {},
      withCredentials: true,
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      // console.log('%c[Socket:Singleton] Connected:', 'color: #00ff00; font-weight: bold;', socket.id);
      globalSocket = socket;
      connectionPromise = null;
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      // console.error('[Socket:Singleton] Connection Error:', err);
      // Don't nullify globalSocket here, let it retry, but nullify promise so next call can try fresh if needed
      connectionPromise = null;
      reject(err);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket:Singleton] Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, you need to reconnect manually
        socket.connect();
      }
    });
  });

  return connectionPromise;
};

export const useSocket = (options: SocketOptions = {}) => {
  const { user, authenticated } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(globalSocket);
  const [isConnected, setIsConnected] = useState(globalSocket?.connected || false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Initialize/Retrieve Connection
  useEffect(() => {
    if (!authenticated || !user) return;

    const init = async () => {
      try {
        const t = typeof document !== 'undefined' 
          ? document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1] 
          : null;

        const s = await getSocket(t || undefined);
        if (!isMounted.current) return;
        
        setSocket(s);
        setIsConnected(s.connected);

        // Individual hook listeners to update local state
        const onConnect = () => {
             if (isMounted.current) setIsConnected(true);
        };
        const onDisconnect = () => {
             if (isMounted.current) setIsConnected(false);
        };

        s.on('connect', onConnect);
        s.on('disconnect', onDisconnect);

        return () => {
          s.off('connect', onConnect);
          s.off('disconnect', onDisconnect);
        };
      } catch (err) {
        console.error('[useSocket] Initialization failed:', err);
      }
    };

    init();
  }, [authenticated, user]);

  // Handle Room Subscriptions (Robust Multi-Registration)
  useEffect(() => {
    if (!socket || !isConnected) return;

    const workspaceId = normalizeRoomId(options.workspaceId);
    const conversationId = normalizeRoomId(options.conversationId);

    const workspaceRoom = workspaceId ? `workspace:${workspaceId}` : null;
    const conversationRoom = conversationId ? `conversation:${conversationId}` : null;

    if (workspaceRoom) {
      // console.log(`%c[Socket:Singleton] Joining Workspace: ${workspaceRoom}`, 'color: #ea580c; font-weight: bold;');
      socket.emit('workspace:join', { workspaceId });
    }

    if (conversationRoom) {
      // console.log(`%c[Socket:Singleton] Joining Conversation: ${conversationRoom}`, 'color: #0891b2; font-weight: bold;');
      socket.emit('conversation:join', { conversationId });
      
      return () => {
        console.log(`[Socket:Singleton] Leaving Conversation: ${conversationRoom}`);
        socket.emit('conversation:leave', { conversationId });
      };
    }
  }, [socket, isConnected, options.workspaceId, options.conversationId]);

  return {
    socket,
    isConnected
  };
};
