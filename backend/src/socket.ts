import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { logger } from './utils/logger';

let io: SocketServer;

// Map userId → socketId
const userSocketMap = new Map<number, string>();

export function initSocket(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:4200',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (userId) {
      userSocketMap.set(+userId, socket.id);
      logger.debug(`Socket connected: user ${userId}`);
    }

    socket.on('disconnect', () => {
      if (userId) userSocketMap.delete(+userId);
    });
  });

  logger.info('🔌 Socket.IO initialized');
}

export function getSocketIO(): SocketServer {
  return io;
}

export function emitToUser(userId: number, event: string, data: any) {
  const socketId = userSocketMap.get(userId);
  if (socketId && io) {
    io.to(socketId).emit(event, data);
  }
}

export function emitToAll(event: string, data: any) {
  if (io) io.emit(event, data);
}
