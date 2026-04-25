/**
 * SOCKET BRIDGE
 * Simple CommonJS bridge to share the Socket.io instance
 * between the custom server.js and Next.js API routes.
 */

let io = null;

module.exports = {
  setIO: (instance) => {
    io = instance;
    global.io = instance;
    console.log("[Socket Bridge] IO instance set");
  },
  getIO: () => {
    return io || global.io;
  }
};
