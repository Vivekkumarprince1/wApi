/**
 * SOCKET BRIDGE
 * Simple bridge to share the Socket.io instance
 * between the server and other services.
 */

let ioInstance: any = null;

export const setIO = (instance: any) => {
  ioInstance = instance;
  (global as any).io = instance;
  console.log("[Socket Bridge] IO instance set");
};

export const getIO = () => {
  return ioInstance || (global as any).io;
};
