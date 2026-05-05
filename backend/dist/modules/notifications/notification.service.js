"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const client_1 = __importDefault(require("../../prisma/client"));
const socket_1 = require("../../socket");
exports.notificationService = {
    async create(data) {
        const notif = await client_1.default.notification.create({ data });
        // Emit real-time via Socket.IO
        (0, socket_1.emitToUser)(data.receiverId, 'notification', {
            id: notif.id,
            type: notif.type,
            title: notif.title,
            titleAr: notif.titleAr,
            message: notif.message,
            messageAr: notif.messageAr,
            taskId: notif.taskId,
            createdAt: notif.createdAt,
        });
        return notif;
    },
    async getForUser(userId, unreadOnly = false) {
        return client_1.default.notification.findMany({
            where: { receiverId: userId, ...(unreadOnly ? { isRead: false } : {}) },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    },
    async markRead(notifId, userId) {
        return client_1.default.notification.update({
            where: { id: notifId, receiverId: userId },
            data: { isRead: true },
        });
    },
    async markAllRead(userId) {
        return client_1.default.notification.updateMany({
            where: { receiverId: userId, isRead: false },
            data: { isRead: true },
        });
    },
    async getUnreadCount(userId) {
        return client_1.default.notification.count({ where: { receiverId: userId, isRead: false } });
    },
};
//# sourceMappingURL=notification.service.js.map