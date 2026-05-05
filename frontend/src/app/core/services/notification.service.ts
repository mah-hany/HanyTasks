import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface Notification {
  id: number;
  type: string;
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  taskId?: number;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  notifications = signal<Notification[]>([]);
  unreadCount = signal<number>(0);
  private socket: Socket | null = null;

  constructor(private http: HttpClient, private authService: AuthService) {
    // Connect socket when user is authenticated
    const user = this.authService.currentUser();
    if (user) this.connectSocket(user.id);
  }

  connectSocket(userId: number) {
    if (this.socket?.connected) return;
    this.socket = io(environment.socketUrl, {
      auth: { userId },
      transports: ['websocket'],
    });

    this.socket.on('notification', (notif: Notification) => {
      this.notifications.update(list => [notif, ...list]);
      this.unreadCount.update(c => c + 1);
    });
  }

  disconnectSocket() {
    this.socket?.disconnect();
    this.socket = null;
  }

  load() {
    return this.http.get<any>(`${environment.apiUrl}/notifications`).pipe(
      tap(res => {
        if (res.success) {
          this.notifications.set(res.data);
          this.unreadCount.set(res.data.filter((n: Notification) => !n.isRead).length);
        }
      })
    );
  }

  markRead(id: number) {
    return this.http.patch(`${environment.apiUrl}/notifications/${id}/read`, {}).pipe(
      tap(() => {
        this.notifications.update(list =>
          list.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
        this.unreadCount.update(c => Math.max(0, c - 1));
      })
    );
  }

  markAllRead() {
    return this.http.patch(`${environment.apiUrl}/notifications/mark-all-read`, {}).pipe(
      tap(() => {
        this.notifications.update(list => list.map(n => ({ ...n, isRead: true })));
        this.unreadCount.set(0);
      })
    );
  }
}
