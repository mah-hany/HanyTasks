import { Component, OnInit, signal, computed, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { LangService } from '../../core/services/lang.service';
import { ChatService } from '../../core/services/chat.service';
import { ChatComponent } from '../../features/chat/chat.component';
import { TaskService } from '../../core/services/task.service';

interface NavItem {
  label: string; labelKey: string; icon: string; route: string;
  roles?: string[]; badge?: number; queryParams?: any; labelOverride?: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, MatIconModule, MatTooltipModule, MatMenuModule, MatBadgeModule, MatDividerModule, TranslateModule, ChatComponent],
  template: `
    <div class="app-wrapper" [class.rtl]="currentLang() === 'ar'">

      <!-- Mobile Overlay -->
      <div class="mobile-overlay" [class.active]="mobileOpen()" (click)="closeMobile()"></div>

      <!-- Sidebar -->
      <aside class="sidebar" [class.collapsed]="sidebarCollapsed() && !isMobile()" [class.mobile-open]="mobileOpen()">
        <!-- Close button on mobile -->
        <button class="sidebar-close-btn" (click)="closeMobile()">
          <mat-icon>close</mat-icon>
        </button>

        <div class="sidebar-logo">
          <div class="logo-icon">
            <span class="logo-monogram">HT</span>
          </div>
          <div class="logo-text" *ngIf="showLabels()">
            <div class="logo-name">Hany Tasks</div>
            <div class="logo-sub">Enterprise ETS</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section-title" *ngIf="showLabels()">{{ 'NAV.DASHBOARD' | translate }}</div>
          <ng-container *ngFor="let item of navItems()">
            <a class="nav-item" [routerLink]="item.route" [queryParams]="item.queryParams || {}"
               routerLinkActive="active"
               (click)="onNavClick()"
               [matTooltip]="(!showLabels()) ? (item.labelKey | translate) : ''"
               matTooltipPosition="after">
              <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
              <span class="nav-label" *ngIf="showLabels()">{{ item.labelOverride || (item.labelKey | translate) }}</span>
              <span class="nav-badge" *ngIf="item.badge && item.badge > 0 && showLabels()">{{ item.badge }}</span>
            </a>
          </ng-container>
        </nav>

        <div class="sidebar-footer">
          <div class="user-info" [matMenuTriggerFor]="userMenu">
            <div class="user-avatar">
              <img *ngIf="user()?.profilePhoto" [src]="user()?.profilePhoto" [alt]="user()?.fullName">
              <span *ngIf="!user()?.profilePhoto">{{ userInitial() }}</span>
            </div>
            <div class="user-details" *ngIf="showLabels()">
              <div class="user-name">{{ currentLang() === 'ar' ? user()?.fullNameAr : user()?.fullName }}</div>
              <div class="user-role">{{ currentLang() === 'ar' ? user()?.role?.nameAr : user()?.role?.name }}</div>
            </div>
            <mat-icon class="user-chevron" *ngIf="showLabels()">expand_less</mat-icon>
          </div>
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item [routerLink]="'/profile'" (click)="onNavClick()">
              <mat-icon>person</mat-icon> <span>{{ 'NAV.PROFILE' | translate }}</span>
            </button>
            <button mat-menu-item (click)="toggleLang(); onNavClick()">
              <mat-icon>language</mat-icon>
              <span>{{ currentLang() === 'ar' ? 'English' : 'العربية' }}</span>
            </button>
            <button mat-menu-item (click)="toggleDark(); onNavClick()">
              <mat-icon>{{ isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
              <span>{{ isDark() ? 'Light Mode' : 'Dark Mode' }}</span>
            </button>
            <mat-divider></mat-divider>
            <button mat-menu-item (click)="logout()" style="color:#dc2626">
              <mat-icon style="color:#dc2626">logout</mat-icon>
              <span>{{ 'NAV.LOGOUT' | translate }}</span>
            </button>
          </mat-menu>
        </div>
      </aside>

      <!-- Main Area -->
      <div class="main-area">
        <!-- Header -->
        <header class="app-header">
          <!-- Mobile hamburger -->
          <button class="toggle-btn mobile-only" (click)="mobileOpen.set(true)" id="mobile-menu-btn">
            <mat-icon>menu</mat-icon>
          </button>
          <!-- Desktop collapse -->
          <button class="toggle-btn desktop-only" (click)="sidebarCollapsed.set(!sidebarCollapsed())">
            <mat-icon>{{ sidebarCollapsed() ? 'menu_open' : 'menu' }}</mat-icon>
          </button>

          <span class="header-spacer"></span>

          <!-- Notification Bell -->
          <button class="header-btn" [routerLink]="'/notifications'"
                  [matBadge]="unreadCount() || null"
                  matBadgeColor="warn" matBadgeSize="small"
                  [matTooltip]="'NAV.NOTIFICATIONS' | translate">
            <mat-icon>notifications_outlined</mat-icon>
          </button>

          <!-- Theme toggle - visible on ALL screen sizes -->
          <button class="header-btn" (click)="toggleDark()" [matTooltip]="isDark() ? 'Light Mode' : 'Dark Mode'">
            <mat-icon>{{ isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>

          <!-- Lang toggle - visible on ALL screen sizes -->
          <button class="header-btn lang-btn" (click)="toggleLang()">
            {{ currentLang() === 'ar' ? 'EN' : 'ع' }}
          </button>
        </header>

        <!-- Page Content -->
        <main class="page-content">
          <router-outlet />
        </main>
      </div>

      <!-- Floating Chat Widget -->
      <app-chat />
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── CSS Variables ── */
    .app-wrapper {
      --sidebar-w: 260px;
      --sidebar-collapsed-w: 68px;
      --header-h: 64px;
      --transition: 0.25s cubic-bezier(.4,0,.2,1);
      display: flex;
      min-height: 100vh;
      position: relative;
      background: var(--bg-main);
    }

    /* ─────────── SIDEBAR ─────────── */
    .sidebar {
      width: var(--sidebar-w);
      min-height: 100vh;
      background: var(--bg-sidebar, #0f172a);
      display: flex;
      flex-direction: column;
      transition: width var(--transition), transform var(--transition);
      overflow: hidden;
      flex-shrink: 0;
      position: relative;
      z-index: 100;
    }

    .sidebar.collapsed {
      width: var(--sidebar-collapsed-w);
    }

    .sidebar-close-btn {
      display: none;
      position: absolute;
      top: 12px;
      inset-inline-end: 12px;
      background: rgba(255,255,255,0.1);
      border: none;
      border-radius: 8px;
      width: 36px; height: 36px;
      cursor: pointer;
      color: #fff;
      align-items: center;
      justify-content: center;
    }

    /* Logo */
    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 16px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    .logo-icon {
      width: 40px; height: 40px;
      border-radius: 10px;
      background: var(--color-primary, #f97316);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      mat-icon { color: #fff; font-size: 22px; }
    }

    .logo-text { overflow: hidden; }
    .logo-name { color: #fff; font-weight: 700; font-size: 14px; white-space: nowrap; }
    .logo-sub  { color: rgba(255,255,255,0.4); font-size: 10px; white-space: nowrap; }

    .logo-monogram {
      font-size: 16px; font-weight: 900; color: #fff; letter-spacing: -1px;
      font-family: 'Inter', sans-serif;
    }

    /* Nav */
    .sidebar-nav {
      flex: 1;
      padding: 12px 8px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .nav-section-title {
      font-size: 10px;
      font-weight: 600;
      color: rgba(255,255,255,0.3);
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 12px 8px;
      white-space: nowrap;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 12px;
      border-radius: 10px;
      color: rgba(255,255,255,0.6);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 2px;
      transition: all var(--transition);
      white-space: nowrap;
      cursor: pointer;

      &:hover { background: rgba(255,255,255,0.08); color: #fff; }
      &.active {
        background: var(--color-primary, #f97316);
        color: #fff;
        box-shadow: 0 4px 15px rgba(249,115,22,0.3);
      }
    }

    .nav-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .nav-label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
    .nav-badge {
      background: #ef4444; color: #fff;
      font-size: 10px; font-weight: 700;
      padding: 1px 6px; border-radius: 20px;
      min-width: 18px; text-align: center;
    }

    /* ── My Tasks Widget ── */
    .my-tasks-widget {
      margin: 0 8px 8px;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
    }

    .myt-header {
      display: flex; align-items: center; gap: 7px;
      padding: 10px 12px 8px;
      font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.9);
      border-bottom: 1px solid rgba(255,255,255,0.07);
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: var(--color-primary, #f97316); }
    }

    .myt-total {
      margin-inline-start: auto;
      background: var(--color-primary, #f97316);
      color: #fff; font-size: 10px; font-weight: 800;
      padding: 1px 7px; border-radius: 20px;
    }

    .myt-loading {
      display: flex; justify-content: center; padding: 12px;
    }

    .myt-spinner {
      width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.15);
      border-top-color: var(--color-primary, #f97316);
      border-radius: 50%;
      animation: myt-spin 0.7s linear infinite;
    }

    @keyframes myt-spin { to { transform: rotate(360deg); } }

    .myt-empty {
      padding: 10px 12px;
      font-size: 11px; color: rgba(255,255,255,0.35); text-align: center;
    }

    .myt-rows {
      display: flex; flex-direction: column;
      max-height: 220px; overflow-y: auto;
      &::-webkit-scrollbar { width: 3px; }
      &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
    }

    .myt-row {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 12px; cursor: pointer; text-decoration: none;
      transition: background 0.15s;
      &:hover { background: rgba(255,255,255,0.07); }
    }

    .myt-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }

    .myt-title {
      flex: 1; font-size: 11.5px; color: rgba(255,255,255,0.75);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .myt-status-lbl {
      font-size: 10px; font-weight: 700; flex-shrink: 0;
      white-space: nowrap;
    }

    .myt-more {
      display: block; text-align: center; padding: 6px 12px;
      font-size: 11px; color: var(--color-primary, #f97316);
      cursor: pointer; text-decoration: none;
      border-top: 1px solid rgba(255,255,255,0.07);
      transition: background 0.15s;
      &:hover { background: rgba(255,255,255,0.05); }
    }

    /* Footer */
    .sidebar-footer {
      padding: 12px 8px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 10px;
      cursor: pointer;
      transition: background var(--transition);
      &:hover { background: rgba(255,255,255,0.08); }
    }

    .user-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: var(--color-primary, #f97316);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      font-weight: 700; color: #fff; font-size: 14px;
      img { width: 100%; height: 100%; object-fit: cover; }
    }

    .user-details { flex: 1; overflow: hidden; }
    .user-name { color: #fff; font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role { color: rgba(255,255,255,0.4); font-size: 11px; white-space: nowrap; }
    .user-chevron { color: rgba(255,255,255,0.4); font-size: 16px; }

    /* ─────────── MAIN AREA ─────────── */
    .main-area {
      flex: 1;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
    }

    /* Header */
    .app-header {
      height: var(--header-h);
      background: var(--bg-card, #fff);
      border-bottom: 1px solid var(--border-color, #e2e8f0);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 8px;
      position: sticky;
      top: 0;
      z-index: 50;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }

    .toggle-btn, .header-btn {
      background: none; border: none; cursor: pointer;
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: var(--text-secondary, #64748b);
      transition: all var(--transition);
      position: relative;
      flex-shrink: 0;
      mat-icon { font-size: 22px; }
      &:hover { background: var(--bg-main, #f8fafc); color: var(--color-primary, #f97316); }
    }

    .lang-btn {
      font-family: 'Cairo', sans-serif;
      font-weight: 700; font-size: 13px;
      width: 40px;
    }

    .header-spacer { flex: 1; }

    /* Visibility helpers */
    .mobile-only { display: none; }

    /* Page content */
    .page-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      background: var(--bg-main, #f8fafc);
    }

    /* Mobile overlay */
    .mobile-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      z-index: 999;
      backdrop-filter: blur(3px);
      opacity: 0;
      transition: opacity var(--transition);
    }
    .mobile-overlay.active {
      display: block;
      opacity: 1;
    }

    /* ─────────── MOBILE ≤ 768px ─────────── */
    @media (max-width: 768px) {
      .app-wrapper { flex-direction: column; }

      /* Sidebar: fixed, full-height, off-screen by default */
      .sidebar {
        position: fixed;
        top: 0;
        inset-inline-start: 0;
        height: 100vh;
        width: 280px !important;
        z-index: 1000;
        transform: translateX(-100%);
        box-shadow: 4px 0 30px rgba(0,0,0,0.3);
      }

      /* RTL: slide from right */
      .app-wrapper.rtl .sidebar {
        transform: translateX(100%);
      }

      .sidebar.mobile-open {
        transform: translateX(0) !important;
      }

      .sidebar-close-btn {
        display: flex;
      }

      /* Main: full width, no offset */
      .main-area {
        width: 100%;
        min-height: 100vh;
        margin-inline-start: 0 !important;
      }

      /* Header buttons visibility */
      .mobile-only { display: flex; }
      .desktop-only { display: none; }

      /* Smaller header padding on mobile */
      .app-header { padding: 0 12px; gap: 4px; }
    }

    /* ─────────── TABLET 769–1024px ─────────── */
    @media (min-width: 769px) and (max-width: 1024px) {
      .sidebar { width: var(--sidebar-collapsed-w) !important; }
      .nav-label, .nav-badge, .logo-text, .nav-section-title, .user-details, .user-chevron { display: none !important; }
      .logo-icon { margin: 0 auto; }
      .user-info { justify-content: center; }
    }
  `],
})
export class ShellComponent implements OnInit {
  sidebarCollapsed = signal(false);
  mobileOpen = signal(false);
  isDark = signal(false);
  currentLang = signal<string>('ar');
  isMobile = signal(false);

  user = computed(() => this.authService.currentUser());
  userInitial = computed(() => {
    const name = this.currentLang() === 'ar'
      ? this.user()?.fullNameAr
      : this.user()?.fullName;
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  unreadCount = computed(() => this.notifService.unreadCount());

  showLabels = computed(() => {
    if (this.isMobile()) return true; // always show in mobile drawer
    return !this.sidebarCollapsed();
  });

  navItems = computed<NavItem[]>(() => {
    const level = this.user()?.role?.level ?? 5;
    const items: NavItem[] = [
      { labelKey: 'NAV.DASHBOARD',    label: 'Dashboard',    icon: 'dashboard',      route: '/dashboard' },
      { labelKey: 'NAV.TASKS',        label: 'Tasks',        icon: 'task_alt',       route: '/tasks' },
      { labelKey: 'NAV.CALENDAR',     label: 'Calendar',     icon: 'calendar_month', route: '/calendar' },
      { labelKey: 'NAV.TEMPLATES',    label: 'Templates',    icon: 'content_copy',   route: '/templates' },
      { labelKey: 'NAV.LEADERBOARD',  label: 'Leaderboard',  icon: 'emoji_events',   route: '/leaderboard' },
      { labelKey: 'NAV.ORG_CHART',    label: 'Org Chart',    icon: 'account_tree',   route: '/org-chart' },
    ];
    // My Tasks nav item — SUPERADMIN only (level 1)
    if (level <= 1) {
      items.push({
        labelKey: 'NAV.TASKS', label: 'مهامي',
        labelOverride: this.currentLang() === 'ar' ? 'مهامي' : 'My Tasks',
        icon: 'assignment_ind', route: '/tasks',
        queryParams: { mine: 'true' }, badge: this.myTasksCount()
      });
    }
    if (level <= 3) {
      items.push({ labelKey: 'NAV.USERS', label: 'Employees', icon: 'people', route: '/users' });
      items.push({ labelKey: 'NAV.REPORTS', label: 'Reports', icon: 'bar_chart', route: '/reports' });
    }
    if (level <= 2) {
      items.push({ labelKey: 'NAV.AUDIT', label: 'Audit Log', icon: 'manage_search', route: '/audit' });
      items.push({ labelKey: 'NAV.SETTINGS', label: 'Settings', icon: 'settings', route: '/settings' });
    }
    items.push({ labelKey: 'NAV.NOTIFICATIONS', label: 'Notifications', icon: 'notifications', route: '/notifications', badge: this.unreadCount() });
    return items;
  });

  @HostListener('window:resize')
  onResize() {
    this.isMobile.set(window.innerWidth <= 768);
    if (window.innerWidth > 768) {
      this.mobileOpen.set(false);
    }
  }

  myTasksCount = signal<number>(0);

  isSuperAdminUser = () => (this.authService.currentUser()?.role?.level ?? 99) <= 1;

  constructor(
    private authService: AuthService,
    private notifService: NotificationService,
    private langService: LangService,
    private translate: TranslateService,
    private router: Router,
    private chatService: ChatService,
    private taskService: TaskService,
  ) {}

  ngOnInit() {
    this.isMobile.set(window.innerWidth <= 768);

    const lang = this.langService.getCurrentLang();
    this.currentLang.set(lang);
    this.isDark.set(document.body.classList.contains('dark-theme'));
    this.notifService.load().subscribe();

    const user = this.authService.currentUser();
    if (user) {
      this.notifService.connectSocket(user.id);
      this.chatService.connectSocket(user.id);
      // Load my tasks count for SUPERADMIN nav badge
      if (this.isSuperAdminUser()) this.loadMyTasksCount();
    }
  }

  loadMyTasksCount() {
    this.taskService.getAll().subscribe({
      next: (res) => {
        if (res.success) {
          const myId = this.authService.currentUser()?.id;
          const count = (res.data as any[]).filter(
            t => t.assignedTo?.id === myId && t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
          ).length;
          this.myTasksCount.set(count);
        }
      },
    });
  }

  onNavClick() {
    if (this.isMobile()) {
      this.mobileOpen.set(false);
    }
  }

  closeMobile() {
    this.mobileOpen.set(false);
  }

  toggleLang() {
    const newLang = this.currentLang() === 'ar' ? 'en' : 'ar';
    this.currentLang.set(newLang);
    this.langService.setLang(newLang as 'ar' | 'en');
    this.translate.use(newLang);
    this.authService.updateLang(newLang);
  }

  toggleDark() {
    const dark = !this.isDark();
    this.isDark.set(dark);
    document.body.classList.toggle('dark-theme', dark);
    localStorage.setItem('tf_theme', dark ? 'dark' : 'light');
  }

  logout() {
    this.notifService.disconnectSocket();
    this.chatService.disconnectSocket();
    this.authService.logout();
  }
}
