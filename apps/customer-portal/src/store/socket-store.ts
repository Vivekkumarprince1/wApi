import React from 'react';
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './auth-store';

import { config as appConfig } from '@/lib/config';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  initialize: () => void;
  disconnect: () => void;
  emit: (event: string, data: any) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,

  initialize: () => {
    if (get().socket?.connected) return;

    const token = typeof document !== 'undefined' ? document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1] : null;
    
    const socketBase = appConfig.socketUrl;

    const socket = io(socketBase || undefined, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      console.log('[SOCKET] Connected');
      set({ connected: true });
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected');
      set({ connected: false });
    });

    socket.on('error', (err) => {
      console.error('[SOCKET] Error:', err);
    });

    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, connected: false });
  },

  emit: (event, data) => {
    get().socket?.emit(event, data);
  },
}));

// Helper hook for functional listeners in components
export const useSocketEvent = (event: string, callback: (data: any) => void) => {
  const { socket, connected } = useSocketStore();

  React.useEffect(() => {
    if (!socket || !connected) return;

    socket.on(event, callback);
    return () => {
      socket.off(event, callback);
    };
  }, [socket, connected, event, callback]);
};
