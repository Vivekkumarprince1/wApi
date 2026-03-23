import { create } from 'zustand';
import io from 'socket.io-client';
import { useAuthStore } from './authStore';
import { useEffect } from 'react';

function resolveSocketUrl() {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.length) {
    const clean = envUrl.replace(/\/$/, '');
    // Strip /api/v1 or /api from the end for socket connection
    return clean.replace(/\/api(\/v1)?$/, '');
  }

  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }

  return 'http://localhost:5001';
}

const SOCKET_URL = resolveSocketUrl();

export const useSocketStore = create((set, get) => ({
  socket: null,
  connected: false,
  
  connect: (token, user, workspace) => {
    const currentSocket = get().socket;
    if (currentSocket) {
      currentSocket.disconnect();
    }

    if (!token || !user || !workspace) {
      set({ socket: null, connected: false });
      return;
    }

    const socketInstance = io(SOCKET_URL, {
      auth: {
        token: token,
        userId: user.id || user._id,
        workspaceId: workspace.id || workspace._id
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      set({ connected: true });
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      set({ connected: false });
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      set({ connected: false });
    });

    set({ socket: socketInstance });
  },

  disconnect: () => {
    const currentSocket = get().socket;
    if (currentSocket) {
        currentSocket.disconnect();
        set({ socket: null, connected: false });
    }
  }
}));

// Setup automatic synchronization with Auth Store
if (typeof window !== 'undefined') {
  useAuthStore.subscribe((state, prevState) => {
    const { user, workspace } = state;
    const prevUser = prevState?.user;
    const prevWorkspace = prevState?.workspace;

    // Only reconnect if user ID or workspace ID meaningfully changed
    const userChanged = user?.id !== prevUser?.id;
    const workspaceChanged = workspace?.id !== prevWorkspace?.id;

    if (userChanged || workspaceChanged) {
      const token = localStorage.getItem('token');
      useSocketStore.getState().connect(token, user, workspace);
    }
  });
}

export function useSocketEvent(eventName, callback) {
  const socket = useSocketStore(state => state.socket);
  
  useEffect(() => {
    if (!socket || !callback) return;
    
    socket.on(eventName, callback);
    return () => socket.off(eventName, callback);
  }, [socket, eventName, callback]);
}

