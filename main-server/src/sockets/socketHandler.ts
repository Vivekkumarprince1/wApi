import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

export const handleSocketEvents = (io: Server, socket: any) => {
  // --- Authentication Middleware for Sockets ---
  socket.use(async ([event, ...args]: any, next: any) => {
    try {
      // Re-verify token on every event if needed, but usually we do it on connection
      // For now, we'll assume the socket.user is populated by a global middleware
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  // Global Auth Middleware for IO instance (Should be in index.ts but we can apply to namespace)
  // Actually, the best way in standalone is to use io.use() in index.ts.
  // I will add the logic here as a helper that can be called.
  
  console.log(`[Socket] Handshake incoming: ${socket.id}`);

  // Heartbeat
  socket.emit("server:ping", { status: "OK", serverTime: new Date().toISOString() });

  // Join user-specific room
  if (socket.user?._id) {
    const userRoom = `user:${socket.user._id.toString()}`;
    socket.join(userRoom);
    console.log(`[Socket] Joined user room: ${userRoom}`);
  }

  /**
   * Workspace Join
   */
  socket.on("workspace:join", (data: { workspaceId: string }) => {
    const { workspaceId } = data;
    if (workspaceId) {
      const workspaceRoom = `workspace:${workspaceId.toString()}`;
      socket.join(workspaceRoom);
      console.log(`[Socket] ${socket.user?.email || 'Unknown'} joined ${workspaceRoom}`);
      
      // Broadcast online status
      if (socket.user) {
        socket.to(workspaceRoom).emit("agent:online", {
          userId: socket.user._id,
          name: socket.user.name,
          email: socket.user.email,
        });
      }
    }
  });

  /**
   * Workspace Leave
   */
  socket.on("workspace:leave", (data: { workspaceId: string }) => {
    const { workspaceId } = data;
    if (workspaceId) {
      const workspaceRoom = `workspace:${workspaceId}`;
      socket.leave(workspaceRoom);
      console.log(`[Socket] ${socket.user?.email || 'Unknown'} left ${workspaceRoom}`);
    }
  });

  /**
   * Conversation Join
   */
  socket.on("conversation:join", async (data: { conversationId: string }) => {
    const { conversationId } = data;
    if (conversationId) {
      const conversationRoom = `conversation:${conversationId.toString()}`;
      socket.join(conversationRoom);
      console.log(`[Socket] ${socket.user?.email || 'Unknown'} joined ${conversationRoom}`);

      socket.to(conversationRoom).emit("conversation:user-joined", {
        conversationId,
        user: socket.user ? { _id: socket.user._id, name: socket.user.name } : null,
      });
    }
  });

  /**
   * Conversation Leave
   */
  socket.on("conversation:leave", (data: { conversationId: string }) => {
    const { conversationId } = data;
    if (conversationId) {
      const conversationRoom = `conversation:${conversationId}`;
      socket.leave(conversationRoom);
      console.log(`[Socket] ${socket.user?.email || 'Unknown'} left ${conversationRoom}`);

      socket.to(conversationRoom).emit("conversation:user-left", {
        conversationId,
        user: socket.user ? { _id: socket.user._id, name: socket.user.name } : null,
      });
    }
  });

  /**
   * Typing indicator
   */
  socket.on("typing", (data: any) => {
    const { conversationId, isTyping = true } = data;
    if (!conversationId) return;

    const payload = {
      conversationId,
      agent: socket.user ? { _id: socket.user._id, name: socket.user.name } : null,
      isTyping,
    };

    socket.to(`conversation:${conversationId}`).emit("conversation:typing", payload);
    
    if (socket.user?.activeWorkspace || socket.user?.workspace) {
      const wsId = socket.user.activeWorkspace || socket.user.workspace;
      socket.to(`workspace:${wsId}`).emit("inbox:typing", payload);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    if (socket.user?.activeWorkspace || socket.user?.workspace) {
      const wsId = socket.user.activeWorkspace || socket.user.workspace;
      socket.to(`workspace:${wsId}`).emit("agent:offline", {
        userId: socket.user?._id,
        name: socket.user?.name,
      });
    }
  });
};

/**
 * Socket Authentication Middleware
 * Ports the logic from server.js io.use()
 */
export const socketAuthMiddleware = async (socket: any, next: any) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(" ")[1] ||
      parseCookie(socket.handshake.headers.cookie || "", "auth_token") ||
      parseCookie(socket.request.headers.cookie || "", "auth_token");

    if (!token) {
      console.warn("[Socket Auth] No token found in auth, headers, or cookies");
      console.log("[Socket Auth] Handshake Headers:", JSON.stringify(socket.handshake.headers, null, 2));
      return next(new Error("Authentication error: No token provided"));
    }

    console.log("[Socket Auth] Token found and verified for socket:", socket.id);

    const { config } = await import('../config');
    const decoded: any = jwt.verify(token, config.jwtSecret);
    
    const User = mongoose.models.User;
    const user = await User.findById(decoded.id).select("-passwordHash");

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = user;
    
    // Auto-join workspace room
    if (user.activeWorkspace || user.workspace) {
      const wsId = user.activeWorkspace || user.workspace;
      socket.join(`workspace:${wsId.toString()}`);
    }

    next();
  } catch (err) {
    console.error("[Socket Auth Error]:", err);
    next(new Error("Authentication error"));
  }
};

function parseCookie(cookieStr: string, key: string) {
  return (
    cookieStr
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${key}=`))
      ?.slice(`${key}=`.length) || null
  );
}
