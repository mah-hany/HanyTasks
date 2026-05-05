import { Component, OnInit, signal, computed } from '@angular/core';
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

interface NavItem {
  label: string; labelKey: string; icon: string; route: string;
  roles?: string[]; badge?: number;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, MatIconModule, MatTooltipModule, MatMenuModule, MatBadgeModule, MatDividerModule, TranslateModule],
  template: `
    <div class="app-wrapper" [class.collapsed]="sidebarCollapsed()">
      <!-- Mobile Overlay -->
      <div class="mobile-overlay" *ngIf="mobileOpen()" (click)="mobileOpen.set(false)"></div>

      <!-- Sidebar -->
      <aside class="sidebar" [class.collapsed]="sidebarCollapsed()" [class.mobile-open]="mobileOpen()">
        <div class="sidebar-logo">
          <div class="logo-icon">
            <mat-icon>task_alt</mat-icon>
          </div>
          <div class="logo-text" *ngIf="!sidebarCollapsed() || mobileOpen()">
            <div class="logo-name">TaskFlow Pro</div>
            <div class="logo-sub">Enterprise ETS</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section-title" *ngIf="!sidebarCollapsed() || mobileOpen()">{{ 'NAV.DASHBOARD' | translate }}</div>
          <ng-container *ngFor="let item of navItems()">
            <a class="nav-item" [routerLink]="item.route" routerLinkActive="active" (click)="mobileOpen.set(false)"
               [matTooltip]="(sidebarCollapsed() && !mobileOpen()) ? (item.labelKey | translate) : ''"
               matTooltipPosition="after">
              <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
              <span class="nav-label" *ngIf="!sidebarCollapsed() || mobileOpen()">{{ item.labelKey | translate }}</span>
              <span class="nav-badge" *ngIf="item.badge && item.badge > 0 && (!sidebarCollapsed() || mobileOpen())">{{ item.badge }}</span>
            </a>
          </ng-container>
        </nav>

        <div class="sidebar-footer">
          <div class="user-info" [matMenuTriggerFor]="userMenu">
            <div class="user-avatar">
              <img *ngIf="user()?.profilePhoto" [src]="user()?.profilePhoto" [alt]="user()?.fullName">
              <span *ngIf="!user()?.profilePhoto">{{ userInitial() }}</span>
            </div>
            <div class="user-details" *ngIf="!sidebarCollapsed() || mobileOpen()">
              <div class="user-name">{{ currentLang() === 'ar' ? user()?.fullNameAr : user()?.fullName }}</div>
              <div class="user-role">{{ currentLang() === 'ar' ? user()?.role?.nameAr : user()?.role?.name }}</div>
            </div>
            <mat-icon style="color:rgba(255,255,255,0.4);font-size:16px" *ngIf="!sidebarCollapsed() || mobileOpen()">expand_less</mat-icon>
          </div>
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item [routerLink]="'/profile'" (click)="mobileOpen.set(false)">
              <mat-icon>person</mat-icon> <span>{{ 'NAV.PROFILE' | translate }}</span>
            </button>
            <button mat-menu-item (click)="toggleLang(); mobileOpen.set(false)">
              <mat-icon>language</mat-icon>
              <span>{{ currentLang() === 'ar' ? 'English' : 'العربية' }}</span>
            </button>
            <button mat-menu-item (click)="toggleDark(); mobileOpen.set(false)">
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
      <div class="main-area" [style.margin-inline-start]="sidebarCollapsed() ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)'">
        <!-- Header -->
        <header class="app-header">
          <button class="toggle-btn desktop-toggle" (click)="sidebarCollapsed.set(!sidebarCollapsed())">
            <mat-icon>{{ sidebarCollapsed() ? 'menu_open' : 'menu' }}</mat-icon>
          </button>
          <button class="toggle-btn mobile-toggle" (click)="mobileOpen.set(true)">
            <mat-icon>menu</mat-icon>
          </button>

          <span class="header-spacer"></span>

          <!-- Notification Bell -->
          <button class="header-btn" [routerLink]="'/notifications'" [matBadge]="unreadCount() || null"
                  matBadgeColor="warn" matBadgeSize="small" [matTooltip]="'NAV.NOTIFICATIONS' | translate">
            <mat-icon>notifications_outlined</mat-icon>
          </button>

          <!-- Theme toggle -->
          <button class="header-btn hide-mobile" (click)="toggleDark()" [matTooltip]="'Dark Mode'">
            <mat-icon>{{ isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>

          <!-- Lang toggle -->
          <button class="header-btn lang-btn hide-mobile" (click)="toggleLang()">
            {{ currentLang() === 'ar' ? 'EN' : 'ع' }}
          </button>
        </header>

        <!-- Page Content -->
        <main class="page-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .app-wrapper { display: flex; min-height: 100vh; position: relative; }

    .main-area {
      flex: 1;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      transition: margin var(--transition);
      width: 100%;
    }

    .page-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      background: var(--bg-main);
    }

    .toggle-btn, .header-btn {
      background: none; border: none; cursor: pointer;
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: var(--text-secondary);
      transition: all var(--transition);
      position: relative;

      mat-icon { font-size: 22px; }
      &:hover { background: var(--bg-main); color: var(--color-primary); }
    }

    .lang-btn {
      font-family: 'Cairo', sans-serif;
      font-weight: 700; font-size: 13px;
      width: 40px;
    }

    .header-spacer { flex: 1; }
    .mobile-toggle { display: none; }
    .mobile-overlay { display: none; }

    @media (max-width: 768px) {
      .sidebar { 
        transform: translateX(-100%); 
        z-index: 1000; 
        width: 280px !important;
      }
      .sidebar.mobile-open { transform: translateX(0); }
      [dir="rtl"] .sidebar { transform: translateX(100%); }
      [dir="rtl"] .sidebar.mobile-open { transform: translateX(0); }
      
      .main-area { margin-inline-start: 0 !important; width: 100%; }
      .desktop-toggle { display: none; }
      .mobile-toggle { display: flex; }
      .hide-mobile { display: none; }
      
      .mobile-overlay {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 999;
        backdrop-filter: blur(4px);
      }
    }
  `],
})
export class ShellComponent implements OnInit {
  sidebarCollapsed = signal(false);
  mobileOpen = signal(false);
  isDark = signal(false);
  currentLang = signal<string>('ar');

  user = computed(() => this.authService.currentUser());
  userInitial = computed(() => {
    const name = this.currentLang() === 'ar'
      ? this.user()?.fullNameAr
      : this.user()?.fullName;
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  unreadCount = computed(() => this.notifService.unreadCount());

  navItems = computed<NavItem[]>(() => {
    const level = this.user()?.role?.level ?? 5;
    const items: NavItem[] = [
      { labelKey: 'NAV.DASHBOARD',    label: 'Dashboard',    icon: 'dashboard',      route: '/dashboard' },
      { labelKey: 'NAV.TASKS',        label: 'Tasks',        icon: 'task_alt',       route: '/tasks' },
      { labelKey: 'NAV.ORG_CHART',    label: 'Org Chart',    icon: 'account_tree',   route: '/org-chart' },
    ];
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

  constructor(
    private authService: AuthService,
    private notifService: NotificationService,
    private langService: LangService,
    private translate: TranslateService,
    private router: Router,
  ) {}

  ngOnInit() {
    const lang = this.langService.getCurrentLang();
    this.currentLang.set(lang);
    this.isDark.set(document.body.classList.contains('dark-theme'));
    this.notifService.load().subscribe();

    // Connect socket
    const user = this.authService.currentUser();
    if (user) this.notifService.connectSocket(user.id);
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
    this.authService.logout();
  }
}
