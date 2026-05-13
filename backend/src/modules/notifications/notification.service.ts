import prisma from '../../prisma/client';
import { emitToUser } from '../../socket';
import { NotificationType } from '../../types/enums';
import { pushService } from './push.service';

export const notificationService = {
  async create(data: {
    receiverId: number; senderId?: number; taskId?: number;
    type: NotificationType; title: string; titleAr: string;
    message: string; messageAr: string;
  }) {
    const notif = await prisma.notification.create({ data });

    // Emit real-time via Socket.IO (in-app)
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

    // Send browser Web Push (fire & forget — never block in-app notification)
    pushService.sendToUser(data.receiverId, {
      title: data.titleAr || data.title,
      body:  data.messageAr || data.message,
      url:   data.taskId ? `/tasks/${data.taskId}` : '/notifications',
      tag:   `notif-${data.type}-${data.receiverId}`,
    }).catch(() => {}); // silent — push failure must NOT break the flow

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
