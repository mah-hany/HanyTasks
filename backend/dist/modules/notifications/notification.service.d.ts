import { NotificationType } from '../../types/enums';
export declare const notificationService: {
    create(data: {
        receiverId: number;
        senderId?: number;
        taskId?: number;
        type: NotificationType;
        title: string;
        titleAr: string;
        message: string;
        messageAr: string;
    }): Promise<{
        message: string;
        id: number;
        createdAt: Date;
        type: string;
        senderId: number | null;
        receiverId: number;
        title: string;
        titleAr: string;
        messageAr: string;
        isRead: boolean;
        taskId: number | null;
    }>;
    getForUser(userId: number, unreadOnly?: boolean): Promise<{
        message: string;
        id: number;
        createdAt: Date;
        type: string;
        senderId: number | null;
        receiverId: number;
        title: string;
        titleAr: string;
        messageAr: string;
        isRead: boolean;
        taskId: number | null;
    }[]>;
    markRead(notifId: number, userId: number): Promise<{
        message: string;
        id: number;
        createdAt: Date;
        type: string;
        senderId: number | null;
        receiverId: number;
        title: string;
        titleAr: string;
        messageAr: string;
        isRead: boolean;
        taskId: number | null;
    }>;
    markAllRead(userId: number): Promise<import(".prisma/client").Prisma.BatchPayload>;
    getUnreadCount(userId: number): Promise<number>;
};
//# sourceMappingURL=notification.service.d.ts.map