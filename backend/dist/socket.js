"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userSocketMap = void 0;
exports.initSocket = initSocket;
exports.getSocketIO = getSocketIO;
exports.emitToUser = emitToUser;
exports.emitToAll = emitToAll;
const socket_io_1 = require("socket.io");
const logger_1 = require("./utils/logger");
let io;
// Map userId → socketId  (exported so chat controller can use it)
exports.userSocketMap = new Map();
function initSocket(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:4200',
            methods: ['GET', 'POST'],
        },
    });
    io.on('connection', (socket) => {
        const userId = socket.handshake.auth?.userId;
        if (userId) {
            exports.userSocketMap.set(+userId, socket.id);
            logger_1.logger.debug(`Socket connected: user ${userId} → ${socket.id}`);
            // Join personal room for targeted chat events
            socket.join(`user:${userId}`);
        }
        socket.on('disconnect', () => {
            if (userId) {
                exports.userSocketMap.delete(+userId);
                logger_1.logger.debug(`Socket disconnected: user ${userId}`);
            }
        });
        // Typing indicator events (forwarded to recipient)
        socket.on('chat:typing', (data) => {
            if (!userId)
                return;
            const recipientSocketId = exports.userSocketMap.get(data.toUserId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('chat:typing', { fromUserId: +userId, isTyping: data.isTyping });
            }
        });
    });
    logger_1.logger.info('🔌 Socket.IO initialized');
}
function getSocketIO() {
    return io;
}
function emitToUser(userId, event, data) {
    const socketId = exports.userSocketMap.get(userId);
    if (socketId && io) {
        io.to(socketId).emit(event, data);
    }
}
function emitToAll(event, data) {
    if (io)
        io.emit(event, data);
}
//# sourceMappingURL=socket.js.map