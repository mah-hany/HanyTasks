"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushService = void 0;
const web_push_1 = __importDefault(require("web-push"));
const client_1 = __importDefault(require("../../prisma/client"));
// ── Setup VAPID ──────────────────────────────────────────────
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@hanytasks.com';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
    web_push_1.default.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}
exports.pushService = {
    // ── Save subscription from browser ──────────────────────
    async subscribe(userId, subscription) {
        return client_1.default.pushSubscription.upsert({
            where: { endpoint: subscription.endpoint },
            create: {
                userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                userAgent: subscription.userAgent,
            },
            update: { userId, userAgent: subscription.userAgent },
        });
    },
    // ── Remove subscription ──────────────────────────────────
    async unsubscribe(endpoint) {
        return client_1.default.pushSubscription.deleteMany({ where: { endpoint } });
    },
    // ── Send push to a specific user (all their devices) ────
    async sendToUser(userId, payload) {
        if (!VAPID_PUBLIC || !VAPID_PRIVATE)
            return; // not configured
        const subs = await client_1.default.pushSubscription.findMany({ where: { userId } });
        if (subs.length === 0)
            return;
        const notification = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/icons/icon-192x192.png',
            badge: payload.badge || '/icons/badge-72x72.png',
            url: payload.url || '/',
            tag: payload.tag || 'hany-tasks',
        });
        // Send to all user devices in parallel, remove expired subscriptions
        const results = await Promise.allSettled(subs.map(sub => web_push_1.default.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, notification)));
        // Clean up expired/invalid subscriptions
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'rejected') {
                const err = result.reason;
                if (err?.statusCode === 410 || err?.statusCode === 404) {
                    // Subscription expired — remove it
                    await client_1.default.pushSubscription.deleteMany({ where: { endpoint: subs[i].endpoint } }).catch(() => { });
                }
            }
        }
    },
    // ── Get VAPID public key for frontend ───────────────────
    getPublicKey() {
        return VAPID_PUBLIC;
    },
};
//# sourceMappingURL=push.service.js.map