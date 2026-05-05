import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '../../core/services/notification.service';
import { LangService } from '../../core/services/lang.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule, TranslateModule],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div class="page-title">
          <h1>{{ 'NOTIFICATIONS.TITLE' | translate }}</h1>
          <p>{{ unreadCount() }} {{ isAr() ? 'غير مقروء' : 'unread' }}</p>
        </div>
        <button mat-stroked-button (click)="markAll()" *ngIf="unreadCount() > 0">
          <mat-icon>done_all</mat-icon>
          {{ 'NOTIFICATIONS.MARK_ALL_READ' | translate }}
        </button>
      </div>

      <div class="tf-card notifications-list">
        <div *ngIf="!notifications().length" class="empty-state">
          <mat-icon>notifications_none</mat-icon>
          <p>{{ 'NOTIFICATIONS.NO_NOTIFICATIONS' | translate }}</p>
        </div>

        <div class="notif-item" *ngFor="let n of notifications()"
             [class.unread]="!n.isRead" (click)="markRead(n)">
          <div class="notif-icon" [class]="getTypeClass(n.type)">
            <mat-icon>{{ getTypeIcon(n.type) }}</mat-icon>
          </div>
          <div class="notif-body">
            <div class="notif-title">{{ isAr() ? n.titleAr : n.title }}</div>
            <div class="notif-msg">{{ isAr() ? n.messageAr : n.message }}</div>
            <div class="notif-time">{{ n.createdAt | date:'dd/MM/yyyy HH:mm' }}</div>
          </div>
          <div class="notif-dot" *ngIf="!n.isRead"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notifications-list { padding: 0; overflow: hidden; }

    .notif-item {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 16px 20px; cursor: pointer; transition: background var(--transition);
      border-bottom: 1px solid var(--border-color); position: relative;
      &:last-child { border-bottom: none; }
      &:hover { background: var(--bg-main); }
      &.unread { background: rgba(46,134,171,0.04); }
    }

    .notif-icon {
      width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 20px; }

      &.assigned { background: rgba(46,134,171,0.1); color: var(--color-primary-light); }
      &.completed { background: rgba(34,197,94,0.1); color: #22c55e; }
      &.overdue   { background: rgba(220,38,38,0.1); color: #dc2626; }
      &.revision  { background: rgba(249,115,22,0.1); color: #f97316; }
      &.system    { background: rgba(100,116,139,0.1); color: var(--text-muted); }
    }

    .notif-body { flex: 1; }
    .notif-title { font-size: 14px; font-weight: 700; margin-bottom: 3px; }
    .notif-msg { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
    .notif-time { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

    .notif-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--color-accent); flex-shrink: 0; margin-top: 4px;
    }

    .empty-state { text-align: center; padding: 60px; color: var(--text-muted);
      mat-icon { font-size: 56px; opacity: 0.2; } p { margin-top: 8px; } }
  `],
})
export class NotificationsComponent implements OnInit {
  notifications = computed(() => this.notifService.notifications());
  unreadCount = computed(() => this.notifService.unreadCount());
  isAr = () => this.langService.getCurrentLang() === 'ar';

  constructor(private notifService: NotificationService, private langService: LangService) {}

  ngOnInit() { this.notifService.load().subscribe(); }

  markRead(notif: any) {
    if (!notif.isRead) this.notifService.markRead(notif.id).subscribe();
  }

  markAll() { this.notifService.markAllRead().subscribe(); }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      TASK_ASSIGNED: 'assignment', TASK_COMPLETED: 'check_circle',
      TASK_OVERDUE: 'warning', TASK_REVISION: 'edit_note', TASK_SUBMITTED: 'send', SYSTEM: 'notifications',
    };
    return icons[type] || 'notifications';
  }

  getTypeClass(type: string): string {
    const classes: Record<string, string> = {
      TASK_ASSIGNED: 'assigned', TASK_COMPLETED: 'completed',
      TASK_OVERDUE: 'overdue', TASK_REVISION: 'revision', TASK_SUBMITTED: 'assigned', SYSTEM: 'system',
    };
    return classes[type] || 'system';
  }
}
