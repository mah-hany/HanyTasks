import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly apiUrl = environment.apiUrl;
  private swReg: ServiceWorkerRegistration | null = null;

  constructor(private http: HttpClient) {}

  // ── تحقق من دعم المتصفح ────────────────────────────────
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // ── تسجيل Service Worker وطلب الإذن وإرسال الـ subscription ──
  async init(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      // تسجيل Service Worker
      this.swReg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // هل لديه إذن مسبق؟
      if (Notification.permission === 'denied') return;

      // هل مشترك مسبقاً؟
      const existing = await this.swReg.pushManager.getSubscription();
      if (existing) {
        // تأكد من حفظه في الـ Backend
        await this.sendSubscriptionToServer(existing);
        return;
      }

      // طلب الإذن من المستخدم
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      // جلب الـ VAPID public key من السيرفر
      const { publicKey } = await this.http
        .get<{ publicKey: string }>(`${this.apiUrl}/push/vapid-key`)
        .toPromise() as any;

      if (!publicKey) return;

      // الاشتراك في Push Manager
      const subscription = await this.swReg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey) as any,
      });

      await this.sendSubscriptionToServer(subscription);

    } catch (err) {
      console.warn('[PushNotifications] Init failed:', err);
    }
  }

  // ── إلغاء الاشتراك ────────────────────────────────────────
  async unsubscribe(): Promise<void> {
    if (!this.swReg) return;
    const sub = await this.swReg.pushManager.getSubscription();
    if (!sub) return;

    await this.http.delete(`${this.apiUrl}/push/unsubscribe`, {
      body: { endpoint: sub.endpoint },
    }).toPromise().catch(() => {});

    await sub.unsubscribe().catch(() => {});
  }

  // ── إرسال اشتراك اختباري (للإعدادات) ────────────────────
  sendTestPush() {
    return this.http.post(`${this.apiUrl}/push/test`, {});
  }

  // ── حالة الإذن الحالية ────────────────────────────────────
  getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  // ── إرسال الـ subscription للسيرفر ───────────────────────
  private async sendSubscriptionToServer(sub: PushSubscription): Promise<void> {
    const json = sub.toJSON() as any;
    await this.http.post(`${this.apiUrl}/push/subscribe`, {
      endpoint:  json.endpoint,
      keys:      { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      userAgent: navigator.userAgent,
    }).toPromise().catch(() => {});
  }

  // ── تحويل Base64 URL للـ Uint8Array (مطلوب للـ VAPID) ───
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = window.atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }
}
