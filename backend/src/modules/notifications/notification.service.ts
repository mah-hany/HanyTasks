import prisma from '../../prisma/client';
import { emitToUser } from '../../socket';
import { NotificationType } from '../../types/enums';

export const notificationService = {
  async create(data: {
    receiverId: number; senderId?: number; taskId?: number;
    type: NotificationType; title: string; titleAr: string;
    message: string; messageAr: string;
  }) {
    const notif = await prisma.notification.create({ data });

    // Emit real-time via Socket.IO
    emitToUser(data.receiverId, 'notification', {
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

  async getForUser(userId: number, unreadOnly = false) {
    return prisma.notification.findMany({
      where: { receiverId: userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },

  async markRead(notifId: number, userId: number) {
    return prisma.notification.update({
      where: { id: notifId, receiverId: userId },
      data: { isRead: true },
    });
  },

  async markAllRead(userId: number) {
    return prisma.notification.updateMany({
      where: { receiverId: userId, isRead: false },
      data: { isRead: true },
    });
  },

  async getUnreadCount(userId: number) {
    return prisma.notification.count({ where: { receiverId: userId, isRead: false } });
  },
};
