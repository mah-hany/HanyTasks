export declare const pushService: {
    subscribe(userId: number, subscription: {
        endpoint: string;
        keys: {
            p256dh: string;
            auth: string;
        };
        userAgent?: string;
    }): Promise<{
        id: number;
        createdAt: Date;
        userAgent: string | null;
        userId: number;
        endpoint: string;
        p256dh: string;
        auth: string;
    }>;
    unsubscribe(endpoint: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    sendToUser(userId: number, payload: {
        title: string;
        body: string;
        icon?: string;
        badge?: string;
        url?: string;
        tag?: string;
    }): Promise<void>;
    getPublicKey(): string;
};
//# sourceMappingURL=push.service.d.ts.map