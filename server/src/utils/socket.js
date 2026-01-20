/**
 * Socket.io Utility - Stage 4 Enhanced
 * Real-time communication for Shared Inbox
 * 
 * Room structure:
 * - workspace:{workspaceId}  - All users in a workspace
 * - user:{userId}            - Specific user (for direct notifications)
 * - conversation:{convId}    - Users viewing a specific conversation
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

let io;

function initSocket(server) {
  if (io) return io;
  
  io = new Server(server, { 
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });
  
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication error'));
      }
      
      const payload = jwt.verify(token, jwtSecret);
      const User = require('../models/User');
      const user = await User.findById(payload.id).select('-passwordHash');
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });
  
  io.on('connection', (socket) => {
    console.log('[SOCKET] Connected:', socket.id, 'User:', socket.user?.email);
    
    // Join workspace room
    if (socket.user?.workspace) {
      const workspaceRoom = `workspace:${socket.user.workspace}`;
      socket.join(workspaceRoom);
      console.log(`[SOCKET] ${socket.user.email} joined ${workspaceRoom}`);
    }
    
    // Join user-specific room (for direct notifications)
    if (socket.user?._id) {
      const userRoom = `user:${socket.user._id}`;
      socket.join(userRoom);
      console.log(`[SOCKET] ${socket.user.email} joined ${userRoom}`);
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 4: CONVERSATION ROOM MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Join a conversation room (when user opens a conversation)
     */
    socket.on('conversation:join', async (data) => {
      const { conversationId } = data;
      
      if (!conversationId) return;
      
      // Verify user has access to this conversation (basic check)
      const Conversation = require('../models/Conversation');
      const Permission = require('../models/Permission');
      
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          workspace: socket.user.workspace
        }).select('assignedTo').lean();
        
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }
        
        // Get user permissions
        const permission = await Permission.findOne({
          workspace: socket.user.workspace,
          user: socket.user._id
        }).lean();
        
        // Check access (owners/managers see all, agents only assigned)
        const canAccess = 
          permission?.role === 'owner' || 
          permission?.role === 'manager' ||
          permission?.permissions?.viewAllConversations ||
          (conversation.assignedTo && conversation.assignedTo.toString() === socket.user._id.toString());
        
        if (!canAccess) {
          socket.emit('error', { message: 'Access denied to conversation' });
          return;
        }
        
        const conversationRoom = `conversation:${conversationId}`;
        socket.join(conversationRoom);
        console.log(`[SOCKET] ${socket.user.email} joined ${conversationRoom}`);
        
        // Notify others that someone joined
        socket.to(conversationRoom).emit('conversation:user-joined', {
          conversationId,
          user: {
            _id: socket.user._id,
            name: socket.user.name
          }
        });
      } catch (err) {
        console.error('[SOCKET] Error joining conversation:', err.message);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });
    
    /**
     * Leave a conversation room (when user closes a conversation)
     */
    socket.on('conversation:leave', (data) => {
      const { conversationId } = data;
      
      if (!conversationId) return;
      
      const conversationRoom = `conversation:${conversationId}`;
      socket.leave(conversationRoom);
      console.log(`[SOCKET] ${socket.user.email} left ${conversationRoom}`);
      
      // Notify others
      socket.to(conversationRoom).emit('conversation:user-left', {
        conversationId,
        user: {
          _id: socket.user._id,
          name: socket.user.name
        }
      });
    });
    
    // ─────────────────────────────────────────────────────────────────────────
    // TYPING INDICATORS
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Agent typing indicator (in conversation)
     */
    socket.on('typing', (data) => {
      const { conversationId, isTyping = true } = data;
      
      if (!conversationId) return;
      
      // Emit to conversation room
      socket.to(`conversation:${conversationId}`).emit('conversation:typing', {
        conversationId,
        agent: {
          _id: socket.user._id,
          name: socket.user.name
        },
        isTyping
      });
      
      // Also emit to workspace for inbox preview updates
      if (socket.user?.workspace) {
        socket.to(`workspace:${socket.user.workspace}`).emit('inbox:typing', {
          conversationId,
          agent: {
            _id: socket.user._id,
            name: socket.user.name
          },
          isTyping
        });
      }
    });
    
    /**
     * Stop typing indicator
     */
    socket.on('typing:stop', (data) => {
      const { conversationId } = data;
      
      if (!conversationId) return;
      
      socket.to(`conversation:${conversationId}`).emit('conversation:typing', {
        conversationId,
        agent: {
          _id: socket.user._id,
          name: socket.user.name
        },
        isTyping: false
      });
    });
    
    // ─────────────────────────────────────────────────────────────────────────
    // PRESENCE (online status)
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Broadcast online status when user connects
     */
    if (socket.user?.workspace) {
      socket.to(`workspace:${socket.user.workspace}`).emit('agent:online', {
        userId: socket.user._id,
        name: socket.user.name,
        email: socket.user.email
      });
    }
    
    /**
     * Handle disconnect
     */
    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected:', socket.id, 'User:', socket.user?.email);
      
      // Broadcast offline status
      if (socket.user?.workspace) {
        socket.to(`workspace:${socket.user.workspace}`).emit('agent:offline', {
          userId: socket.user._id,
          name: socket.user.name
        });
      }
    });
    
    // ─────────────────────────────────────────────────────────────────────────
    // PING/PONG for connection health
    // ─────────────────────────────────────────────────────────────────────────
    
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  });
  
  return io;
}

function getIO() {
  if (!io) {
    console.warn('[SOCKET] Socket.io not initialized, returning null');
    return null;
  }
  return io;
}

/**
 * Emit to a specific room
 */
function emitToRoom(room, event, data) {
  const socketIO = getIO();
  if (socketIO) {
    socketIO.to(room).emit(event, data);
  }
}

/**
 * Emit to workspace
 */
function emitToWorkspace(workspaceId, event, data) {
  emitToRoom(`workspace:${workspaceId}`, event, data);
}

/**
 * Emit to specific user
 */
function emitToUser(userId, event, data) {
  emitToRoom(`user:${userId}`, event, data);
}

/**
 * Emit to conversation viewers
 */
function emitToConversation(conversationId, event, data) {
  emitToRoom(`conversation:${conversationId}`, event, data);
}

module.exports = { 
  initSocket, 
  getIO,
  emitToRoom,
  emitToWorkspace,
  emitToUser,
  emitToConversation
};
