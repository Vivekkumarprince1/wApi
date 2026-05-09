import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Permission } from '../models';

async function userIsWorkspaceMember(userId: any, workspaceId: string): Promise<boolean> {
  if (!userId || !workspaceId) return false;
  if (!mongoose.isValidObjectId(workspaceId)) return false;
  try {
    const membership = await Permission.findOne({
      user: userId,
      workspace: workspaceId,
      isActive: { $ne: false },
    }).lean();
    return !!membership;
  } catch (err) {
    console.warn('[Socket] Membership lookup failed:', (err as any)?.message);
    return false;
  }
}

async function userCanJoinConversation(userId: any, conversationId: string): Promise<boolean> {
  if (!userId || !conversationId) return false;
  if (!mongoose.isValidObjectId(conversationId)) return false;
  try {
    const Conversation = mongoose.models.Conversation;
    if (!Conversation) return false;
    const convo: any = await Conversation.findById(conversationId).select('workspace').lean();
    if (!convo?.workspace) return false;
    return userIsWorkspaceMember(userId, String(convo.workspace));
  } catch (err) {
    console.warn('[Socket] Conversation membership lookup failed:', (err as any)?.message);
    return false;
  }
}

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
   * Workspace Join — must be authenticated AND a member of the workspace.
   */
  socket.on("workspace:join", async (data: { workspaceId: string }) => {
    const { workspaceId } = data || ({} as any);
    if (!workspaceId) return;

    if (!socket.user?._id) {
      console.warn(`[Socket] Refused workspace:join — unauthenticated socket ${socket.id}`);
      socket.emit('socket:error', { event: 'workspace:join', reason: 'unauthenticated' });
      return;
    }

    const isMember = await userIsWorkspaceMember(socket.user._id, String(workspaceId));
    if (!isMember && socket.user?.role !== 'super_admin') {
      console.warn(`[Socket] Refused workspace:join for ${socket.user.email} → ${workspaceId} (not a member)`);
      socket.emit('socket:error', { event: 'workspace:join', reason: 'forbidden', workspaceId });
      return;
    }

    const workspaceRoom = `workspace:${String(workspaceId)}`;
    socket.join(workspaceRoom);
    console.log(`[Socket] ${socket.user?.email || 'Unknown'} joined ${workspaceRoom}`);

    socket.to(workspaceRoom).emit("agent:online", {
      userId: socket.user._id,
      name: socket.user.name,
      email: socket.user.email,
    });
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
   * Conversation Join — must be a member of the conversation's workspace.
   */
  socket.on("conversation:join", async (data: { conversationId: string }) => {
    const { conversationId } = data || ({} as any);
    if (!conversationId) return;

    if (!socket.user?._id) {
      console.warn(`[Socket] Refused conversation:join — unauthenticated socket ${socket.id}`);
      socket.emit('socket:error', { event: 'conversation:join', reason: 'unauthenticated' });
      return;
    }

    const allowed = socket.user?.role === 'super_admin'
      || await userCanJoinConversation(socket.user._id, String(conversationId));
    if (!allowed) {
      console.warn(`[Socket] Refused conversation:join for ${socket.user.email} → ${conversationId} (not a member)`);
      socket.emit('socket:error', { event: 'conversation:join', reason: 'forbidden', conversationId });
      return;
    }

    const conversationRoom = `conversation:${String(conversationId)}`;
    socket.join(conversationRoom);
    console.log(`[Socket] ${socket.user?.email || 'Unknown'} joined ${conversationRoom}`);

    socket.to(conversationRoom).emit("conversation:user-joined", {
      conversationId,
      user: { _id: socket.user._id, name: socket.user.name },
    });
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
    // Try to get token from multiple sources in order
    let token: string | null = null;
    let tokenSource = '';

    // Source 1: Socket auth payload (frontend sends this)
    if (socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
      tokenSource = 'auth payload';
    }
    // Source 2: Authorization header
    else if (socket.handshake.headers.authorization) {
      token = socket.handshake.headers.authorization.split(" ")[1];
      tokenSource = 'Authorization header';
    }
    // Source 3: Cookies (handshake headers)
    else if (socket.handshake.headers.cookie) {
      token = parseCookie(socket.handshake.headers.cookie, "auth_token");
      if (token) tokenSource = 'Cookie (handshake headers)';
    }
    // Source 4: Request cookies
    if (!token && socket.request.headers.cookie) {
      token = parseCookie(socket.request.headers.cookie, "auth_token");
      if (token) tokenSource = 'Cookie (request headers)';
    }

    if (!token) {
      console.warn(`[Socket Auth] No auth token found for socket ${socket.id}`);
      return next(new Error('Unauthorized: missing auth token'));
    }

    console.log(`[Socket Auth] Token found from: ${tokenSource} (Socket: ${socket.id})`);

    const { config } = await import('../config');
    let decoded: any;

    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (jwtErr: any) {
      console.warn(`[Socket Auth] Invalid token for socket ${socket.id}: ${jwtErr.message}`);
      return next(new Error('Unauthorized: invalid token'));
    }

    if (!decoded?.id) {
      return next(new Error('Unauthorized: token missing user id'));
    }

    const User = mongoose.models.User;
    const user = await User.findById(decoded.id).select("-passwordHash");

    if (!user) {
      return next(new Error('Unauthorized: user not found'));
    }

    console.log(`[Socket Auth] Authenticated as ${user.email} (Socket: ${socket.id})`);
    socket.user = user;

    // Auto-join the user's active workspace room only if they actually
    // have membership; otherwise let workspace:join run the explicit check.
    const wsId = user.activeWorkspace || user.workspace;
    if (wsId) {
      const isMember = await userIsWorkspaceMember(user._id, String(wsId));
      if (isMember || user.role === 'super_admin') {
        socket.join(`workspace:${String(wsId)}`);
        console.log(`[Socket Auth] Joined workspace room: workspace:${String(wsId)}`);
      }
    }

    next();
  } catch (err: any) {
    console.error("[Socket Auth] Unexpected error during auth:", err.message);
    next(new Error('Unauthorized: internal error'));
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
