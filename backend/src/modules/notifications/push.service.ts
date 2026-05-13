import webpush from 'web-push';
import prisma from '../../prisma/client';

// ── Setup VAPID ──────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL   = process.env.VAPID_EMAIL       || 'mailto:admin@hanytasks.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export const pushService = {
  // ── Save subscription from browser ──────────────────────
  async subscribe(userId: number, subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
  }) {
    return prisma.pushSubscription.upsert({
      where:  { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint:  subscription.endpoint,
        p256dh:    subscription.keys.p256dh,
        auth:      subscription.keys.auth,
        userAgent: subscription.userAgent,
      },
      update: { userId, userAgent: subscription.userAgent },
    });
  },

  // ── Remove subscription ──────────────────────────────────
  async unsubscribe(endpoint: string) {
    return prisma.pushSubscription.deleteMany({ where: { endpoint } });
  },

  // ── Send push to a specific user (all their devices) ────
  async sendToUser(userId: number, payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    tag?: string;
  }) {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return; // not configured

    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return;

    const notification = JSON.stringify({
      title:  payload.title,
      body:   payload.body,
      icon:   payload.icon  || '/icons/icon-192x192.png',
      badge:  payload.badge || '/icons/badge-72x72.png',
      url:    payload.url   || '/',
      tag:    payload.tag   || 'hany-tasks',
    });

    // Send to all user devices in parallel, remove expired subscriptions
    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification
        )
      )
    );

    // Clean up expired/invalid subscriptions
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        const err = result.reason as any;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          // Subscription expired — remove it
          await prisma.pushSubscription.deleteMany({ where: { endpoint: subs[i].endpoint } }).catch(() => {});
        }
      }
    }
  },

  // ── Get VAPID public key for frontend ───────────────────
  getPublicKey() {
    return VAPID_PUBLIC;
  },
};
