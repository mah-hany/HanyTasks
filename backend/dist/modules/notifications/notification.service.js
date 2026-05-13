"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const client_1 = __importDefault(require("../../prisma/client"));
const socket_1 = require("../../socket");
const push_service_1 = require("./push.service");
exports.notificationService = {
    async create(data) {
        const notif = await client_1.default.notification.create({ data });
        // Emit real-time via Socket.IO (in-app)
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
        // Send browser Web Push (fire & forget — never block in-app notification)
        push_service_1.pushService.sendToUser(data.receiverId, {
            title: data.titleAr || data.title,
            body: data.messageAr || data.message,
            url: data.taskId ? `/tasks/${data.taskId}` : '/notifications',
            tag: `notif-${data.type}-${data.receiverId}`,
        }).catch(() => { }); // silent — push failure must NOT break the flow
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