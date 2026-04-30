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

// --- STARTUP GUARDS: Crash early if critical env vars are missing ---
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required.");
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error("FATAL: MONGODB_URI environment variable is required.");
  process.exit(1);
}
if (!process.env.REDIS_URL) {
  console.error("FATAL: REDIS_URL environment variable is required.");
  process.exit(1);
}

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

function normalizeOriginCandidate(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (trimmed === "*" || trimmed === "**") return trimmed;

  try {
    const url = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map(normalizeOriginCandidate)
    .filter(Boolean);
}

function getRequestOrigin(req) {
  const host = req.get("host");
  if (!host) return null;

  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";

  return normalizeOriginCandidate(`${protocol}://${host}`);
}

const allowedOrigins = new Set([
  ...parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  ...parseAllowedOrigins(process.env.ALLOWED_ORIGIN),
  ...parseAllowedOrigins(process.env.ALLOWED_DEV_ORIGINS),
  ...parseAllowedOrigins(process.env.APP_URL),
  ...parseAllowedOrigins(process.env.NEXT_PUBLIC_APP_URL),
  ...parseAllowedOrigins(process.env.FRONTEND_URL),
]);

// Initialize Next.js app
const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  server.set("trust proxy", true);

  server.use((req, res, next) => {
    const origin = req.get("origin");
    if (!origin) {
      return next();
    }

    const normalizedOrigin = normalizeOriginCandidate(origin);
    const currentOrigin = getRequestOrigin(req);
    const allowAnyOrigin = allowedOrigins.has("*") || allowedOrigins.has("**");
    const isAllowed =
      allowAnyOrigin ||
      (normalizedOrigin && allowedOrigins.has(normalizedOrigin)) ||
      (normalizedOrigin && currentOrigin && normalizedOrigin === currentOrigin);

    res.setHeader("Vary", "Origin");

    if (isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, x-idempotency-key, idempotency-key, Accept, Origin"
      );

      if (req.method === "OPTIONS") {
        return res.status(204).end();
      }

      return next();
    }

    if (req.method === "OPTIONS") {
      return res.status(403).json({ error: "Origin not allowed" });
    }

    return res.status(403).json({ error: "Origin not allowed" });
  });

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

let activeServer;

const startServer = (portToTry) => {
  const httpServer = createServer(server);
  activeServer = httpServer;

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
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtErr) {
        console.error("[SOCKET] JWT Verification Failed:", jwtErr.message);
        return next(new Error("Authentication error: Invalid token"));
      }
      
      console.log(`[SOCKET] Handshake: JWT verified for ID ${payload.id}. Checking DB...`);

      // Dynamic model lookup to avoid requiring TS files in CJS server
      // Ensure DB is connected before attempting lookup
      if (mongoose.connection.readyState !== 1) {
        const mongoUri = process.env.MONGODB_URI;
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

  // Diagnostic Heartbeat (30s interval to reduce overhead)
  setInterval(() => {
    if (io) {
      const clients = io.sockets.sockets.size;
      if (clients > 0) {
        io.emit('server:ping', { 
          timestamp: Date.now(), 
          activeClients: clients,
          rooms: io.sockets.adapter.rooms.size
        });
      }
    }
  }, 30000);

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

  const currentServer = startServer(port);

  // Graceful Shutdown
  function gracefulShutdown(signal) {
    console.log(`\n[${signal}] Received. Shutting down monolith gracefully...`);
    if (activeServer) {
      activeServer.close(async () => {
        console.log('HTTP server closed.');
        try {
          if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close(false);
            console.log('Database connection closed.');
          }
          process.exit(0);
        } catch (err) {
          console.error('Error during database disconnection:', err);
          process.exit(1);
        }
      });

      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(0);
    }
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

}).catch((err) => {
  console.error("Error preparing Next.js app:", err);
  process.exit(1);
});
