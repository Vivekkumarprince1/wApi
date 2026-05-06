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

const getSocket = async (): Promise<Socket> => {
  // If already connected, return it
  if (globalSocket?.connected) return globalSocket;
  // If connection is in progress, return the existing promise
  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise(async (resolve, reject) => {
    const socketBase = appConfig.socketUrl;

    // Try to get token from multiple sources
    let token: string | null = null;

    // Source 1: SessionStorage (stored during login)
    if (typeof sessionStorage !== 'undefined') {
      token = sessionStorage.getItem('socket_auth_token');
      if (token) console.log('[Socket:Singleton] 🔐 Found token in sessionStorage');
    }

    // Source 2: Try to read from auth_token cookie (accessible)
    if (!token && typeof document !== 'undefined') {
      const allCookies = document.cookie;
      const cookieArray = allCookies.split(';');
      const authCookie = cookieArray.find(row => row.trim().startsWith('auth_token='));
      token = authCookie ? authCookie.split('=')[1]?.trim() : null;
      if (token) console.log('[Socket:Singleton] 🍪 Found auth_token cookie');
    }

    // Source 3: Fetch fresh token from session endpoint if not found
    if (!token) {
      try {
        console.log('[Socket:Singleton] 🔄 Token not found locally, fetching from session endpoint...');
        const response = await fetch('/api/v1/auth/session', {
          method: 'GET',
          credentials: 'include',
        });
        if (response.ok) {
          const session = await response.json();
          token = session.token; // Backend should return token in session response
          if (token) {
            console.log('[Socket:Singleton] ✓ Got token from session endpoint');
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('socket_auth_token', token);
            }
          }
        }
      } catch (err) {
        console.warn('[Socket:Singleton] ⚠️ Could not fetch token from session:', err);
      }
    }

    console.log('[Socket:Singleton] 🌐 Connecting to:', socketBase);
    if (token) {
      console.log('[Socket:Singleton] 🔑 Found auth token (Length: ' + token.length + ')');
    } else {
      console.warn('[Socket:Singleton] ⚠️ No auth token available. Will attempt connection with withCredentials.');
    }

    const socket = io(socketBase, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      // console.log('%c[Socket:Singleton] Connected:', 'color: #00ff00; font-weight: bold;', socket.id);
      globalSocket = socket;
      connectionPromise = null;
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      // ONLY reject if it's a fatal authentication error from the server
      if (err.message?.includes('Authentication error') || err.message?.includes('No token provided')) {
        console.error('[Socket:Singleton] ❌ FATAL AUTH ERROR:', err.message);
        connectionPromise = null;
        reject(err);
      } else {
        // Log but don't reject yet, let it retry/fallback
        console.warn('[Socket:Singleton] 🔄 Connection Attempt Error (Retrying...):', err.message);
      }
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
        const s = await getSocket();
        if (!isMounted.current) return;
        
        setSocket(s);
        setIsConnected(s.connected);

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
