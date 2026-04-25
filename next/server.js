const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const express = require("express");
const { Server: SocketIOServer } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const IORedis = require("ioredis");
const mongoose = require("mongoose");
const { setIO } = require("./src/lib/services/socket-bridge");

require("dotenv").config();

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js app
const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  // Attach API routes or Middleware here
  // Note: Global body-parsers (express.json) are disabled to prevent conflict with Next.js App Router

  // Custom API endpoint example before Next.js catches it
  server.get("/api/health", (req, res) => {
    res.json({ status: "ok", type: "custom-server" });
  });

  // Next.js catch-all
  server.use((req, res) => {
    return handle(req, res);
  });

  function readCookieToken(cookieHeader = "") {
  return (
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("auth_token="))
      ?.slice("auth_token=".length) || null
  );
}

const startServer = (portToTry) => {
  const httpServer = createServer(server);

  // Attach Socket.io
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Redis Adapter for Scaling & Cross-Process Communication
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const pubClient = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const subClient = pubClient.duplicate();
  
  io.adapter(createAdapter(pubClient, subClient));
  console.log(`[PID:${process.pid}] [Socket] Redis Adapter attached`);

  // Initialize bridge for API routes
  setIO(io);
  console.log(`[PID:${process.pid}] [Socket Bridge] IO instance set and ready`);

  // Authentication middleware
  io.use(async (socket, next) => {
    console.log(`[PID:${process.pid}] [SOCKET] Handshake incoming from ${socket.id}`);
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(" ")[1] ||
        readCookieToken(socket.handshake.headers.cookie || "");

      if (!token) {
        console.warn("[SOCKET] Auth Attempt Refused: No token provided");
        return next(new Error("Authentication error: No token provided"));
      }

      const jwt = require("jsonwebtoken");
      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
      } catch (jwtErr) {
        console.error("[SOCKET] JWT Verification Failed:", jwtErr.message);
        return next(new Error("Authentication error: Invalid token"));
      }
      
      console.log(`[SOCKET] Handshake: JWT verified for ID ${payload.id}. Checking DB...`);

      // Dynamic model lookup to avoid requiring TS files in CJS server
      // Ensure DB is connected before attempting lookup
      if (mongoose.connection.readyState !== 1) {
        const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/wapi_new"; 
        await mongoose.connect(mongoUri);
        console.log("[SOCKET] Database connected via handshake middleware");
      }

      const User = mongoose.models.User;
      if (!User) {
        console.error(`[PID:${process.pid}] [SOCKET] Fatal Auth Error: User model not registered. Available models: ${Object.keys(mongoose.models).join(', ')}`);
        return next(new Error("Internal server error: auth"));
      }

      const user = await User.findById(payload.id).select("-passwordHash");

      if (!user) {
        console.error(`[PID:${process.pid}] [SOCKET] Authentication failed: User not found for ID ${payload.id}`);
        return next(new Error("User not found"));
      }

      console.log(`[PID:${process.pid}] [SOCKET] Auth Success: ${user.email} (Workspace ID: ${user.workspace?.toString() || 'NONE'})`);
      socket.user = user;
      next();
    } catch (err) {
      console.error("[SOCKET] Auth Middleware Error:", err.message);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    // Immediate heartbeat to confirm two-way pipe
    socket.emit("server:ping", { status: "OK", serverTime: new Date().toISOString(), pid: process.pid });
    
    const userEmail = socket.user?.email || 'Unknown';
    console.log(`[PID:${process.pid}] [SOCKET] Connected: ${socket.id} User: ${userEmail}`);

    // Join workspace room (Automatic on connection if available)
    if (socket.user?.workspace) {
      const workspaceIdStr = socket.user.workspace.toString();
      const workspaceRoom = `workspace:${workspaceIdStr}`;
      socket.join(workspaceRoom);
      
      console.log(`\x1b[32m[SOCKET:AUTO-JOIN] ${userEmail} joined ${workspaceRoom} (Room Size: ${io.sockets.adapter.rooms.get(workspaceRoom)?.size || 0})\x1b[0m`);

      // Broadcast online status
      socket.to(workspaceRoom).emit("agent:online", {
        userId: socket.user._id,
        name: socket.user.name,
        email: socket.user.email,
      });
    }

    // Join user-specific room
    if (socket.user?._id) {
      const userRoom = `user:${socket.user._id}`;
      socket.join(userRoom);
    }

    /**
     * Join a workspace room explicitly
     */
    socket.on("workspace:join", async (data) => {
      const { workspaceId } = data;
      if (!workspaceId) return;

      const workspaceRoom = `workspace:${workspaceId.toString()}`;
      socket.join(workspaceRoom);
      console.log(`\x1b[35m[SOCKET:WORKSPACE] ${socket.user?.email || 'Unknown'} joined ${workspaceRoom} (Total: ${io.sockets.adapter.rooms.get(workspaceRoom)?.size || 0})\x1b[0m`);
    });

    /**
     * Leave a workspace room explicitly
     */
    socket.on("workspace:leave", (data) => {
      const { workspaceId } = data;
      if (!workspaceId) return;

      const workspaceRoom = `workspace:${workspaceId}`;
      socket.leave(workspaceRoom);
      console.log(`[SOCKET] ${socket.user.email} left ${workspaceRoom}`);
    });

    /**
     * Join a conversation room
     */
    socket.on("conversation:join", async (data) => {
      const { conversationId } = data;
      if (!conversationId) return;

      try {
        const Conversation = mongoose.models.Conversation;
        if (!Conversation) {
             socket.emit("error", { message: "Internal server error: models" });
             return;
        }

        const conversation = await Conversation.findOne({
          _id: conversationId,
          workspace: socket.user.workspace,
        }).lean();

        if (!conversation) {
          socket.emit("error", { message: "Conversation not found" });
          return;
        }

        const conversationRoom = `conversation:${conversationId.toString()}`;
        socket.join(conversationRoom);
        console.log(`\x1b[36m[SOCKET:CONVERSATION] ${socket.user.email} joined ${conversationRoom} (Total: ${io.sockets.adapter.rooms.get(conversationRoom)?.size || 0})\x1b[0m`);

        socket.to(conversationRoom).emit("conversation:user-joined", {
          conversationId,
          user: { _id: socket.user._id, name: socket.user.name },
        });
      } catch (err) {
        console.error("[SOCKET] Error joining conversation:", err.message);
      }
    });

    /**
     * Leave a conversation room
     */
    socket.on("conversation:leave", (data) => {
      const { conversationId } = data;
      if (!conversationId) return;

      const conversationRoom = `conversation:${conversationId}`;
      socket.leave(conversationRoom);
      console.log(`[SOCKET] ${socket.user.email} left ${conversationRoom}`);

      socket.to(conversationRoom).emit("conversation:user-left", {
        conversationId,
        user: { _id: socket.user._id, name: socket.user.name },
      });
    });

    /**
     * Typing indicators
     */
    socket.on("typing", (data) => {
      const { conversationId, isTyping = true } = data;
      if (!conversationId) return;

      const payload = {
        conversationId,
        agent: { _id: socket.user._id, name: socket.user.name },
        isTyping,
      };

      socket.to(`conversation:${conversationId}`).emit("conversation:typing", payload);
      
      if (socket.user?.workspace) {
        socket.to(`workspace:${socket.user.workspace}`).emit("inbox:typing", payload);
      }
    });

    socket.on("disconnect", () => {
      console.log("[SOCKET] Disconnected:", socket.id, "User:", socket.user?.email);
      if (socket.user?.workspace) {
        socket.to(`workspace:${socket.user.workspace}`).emit("agent:offline", {
          userId: socket.user._id,
          name: socket.user.name,
        });
      }
    });
  });

  // Diagnostic Heartbeat
  setInterval(() => {
    if (global.io) {
      const clients = global.io.sockets.sockets.size;
      if (clients > 0) {
        global.io.emit('server:ping', { 
          timestamp: Date.now(), 
          activeClients: clients,
          rooms: global.io.sockets.adapter.rooms.size
        });
      }
    }
  }, 5000);

  httpServer.listen(portToTry, () => {
      console.log(
        `> Server listening at http://localhost:${portToTry} as ${
          dev ? "development" : process.env.NODE_ENV
        }`
      );
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`> Port ${portToTry} is in use, trying ${portToTry + 1}...`);
        startServer(portToTry + 1);
      } else {
        console.error("Error starting server:", err);
        process.exit(1);
      }
    });
  };

  startServer(port);

}).catch((err) => {
  console.error("Error preparing Next.js app:", err);
  process.exit(1);
});
