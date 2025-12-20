const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

let io;

function initSocket(server) {
  if (io) return io;
  
  io = new Server(server, { 
    cors: { origin: '*' },
    transports: ['websocket', 'polling']
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
    console.log('Socket connected:', socket.id, 'User:', socket.user?.email);
    
    // Join workspace room
    if (socket.user?.workspace) {
      const roomName = `workspace:${socket.user.workspace}`;
      socket.join(roomName);
      console.log(`User ${socket.user.email} joined room ${roomName}`);
    }
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
    
    // Handle typing indicators
    socket.on('typing', (data) => {
      if (socket.user?.workspace) {
        socket.to(`workspace:${socket.user.workspace}`).emit('user.typing', {
          userId: socket.user._id,
          userName: socket.user.name,
          contactId: data.contactId
        });
      }
    });
  });
  
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket not initialized');
  return io;
}

module.exports = { initSocket, getIO };
