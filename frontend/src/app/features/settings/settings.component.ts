import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LangService } from '../../core/services/lang.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule, TranslateModule, MatIconModule, MatButtonModule, MatInputModule, MatFormFieldModule, MatSelectModule, MatProgressSpinnerModule, MatTabsModule, MatSlideToggleModule, MatTooltipModule],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div class="page-title">
          <h1>{{ 'NAV.SETTINGS' | translate }}</h1>
          <p>{{ isAr() ? 'إعدادات النظام العامة والصلاحيات' : 'General System Settings & Permissions' }}</p>
        </div>
        <div class="page-actions" *ngIf="!loading()">
          <button mat-flat-button color="primary" class="tf-btn-primary" (click)="saveAll()" [disabled]="saving()">
            <mat-icon>{{ saving() ? 'hourglass_empty' : 'save' }}</mat-icon>
            {{ 'COMMON.SAVE' | translate }}
          </button>
        </div>
      </div>

      <div *ngIf="loading()" class="loading-center">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <mat-tab-group *ngIf="!loading()" animationDuration="0ms">
        <mat-tab label="{{ isAr() ? 'عام' : 'General' }}">
          <div class="settings-grid" style="margin-top: 24px;">
            <div class="settings-card premium-glass">
              <h3 class="card-title"><mat-icon>tune</mat-icon> {{ isAr() ? 'تفضيلات التطبيق' : 'Application Preferences' }}</h3>
              
              <mat-form-field appearance="outline" class="tf-full-width">
                <mat-label>{{ isAr() ? 'اسم التطبيق' : 'Application Name' }}</mat-label>
                <input matInput [(ngModel)]="settings['app_name']" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="tf-full-width">
                <mat-label>{{ isAr() ? 'اللغة الافتراضية' : 'Default Language' }}</mat-label>
                <mat-select [(ngModel)]="settings['default_lang']">
                  <mat-option value="ar">العربية</mat-option>
                  <mat-option value="en">English</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="settings-card premium-glass">
              <h3 class="card-title"><mat-icon>security</mat-icon> {{ isAr() ? 'إعدادات الأمان' : 'Security Settings' }}</h3>

              <mat-form-field appearance="outline" class="tf-full-width">
                <mat-label>{{ isAr() ? 'الحد الأقصى لمحاولات الدخول الفاشلة' : 'Max Failed Logins' }}</mat-label>
                <input matInput type="number" [(ngModel)]="settings['max_failed_logins']" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="tf-full-width">
                <mat-label>{{ isAr() ? 'مدة القفل (بالدقائق)' : 'Lockout Duration (Minutes)' }}</mat-label>
                <input matInput type="number" [(ngModel)]="settings['lockout_minutes']" />
              </mat-form-field>
            </div>

            <div class="settings-card premium-glass">
              <h3 class="card-title"><mat-icon>notifications_active</mat-icon> {{ isAr() ? 'إعدادات التنبيهات' : 'Notification Settings' }}</h3>

              <mat-form-field appearance="outline" class="tf-full-width">
                <mat-label>{{ isAr() ? 'التنبيه قبل (أيام)' : 'Alert Before (Days)' }}</mat-label>
                <input matInput type="number" [(ngModel)]="settings['alert_before_days']" />
              </mat-form-field>
            </div>
          </div>
        </mat-tab>

        <mat-tab label="{{ isAr() ? 'الصلاحيات (الأدوار)' : 'Roles & Permissions' }}">
          <div style="margin-top: 24px; display:flex; flex-direction: column; gap: 24px; padding-bottom: 40px;">
            <div *ngFor="let role of roles" class="premium-glass">
              <h3 class="card-title" style="margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                <mat-icon>admin_panel_settings</mat-icon> 
                {{ isAr() ? role.nameAr : role.name }}
              </h3>
              
              <div class="table-responsive">
                <table class="tf-table">
                  <thead>
                    <tr>
                      <th>{{ isAr() ? 'الوحدة' : 'Module' }}</th>
                      <th>{{ isAr() ? 'عرض' : 'Read' }}</th>
                      <th>{{ isAr() ? 'إضافة' : 'Create' }}</th>
                      <th>{{ isAr() ? 'تعديل' : 'Update' }}</th>
                      <th>{{ isAr() ? 'حذف' : 'Delete' }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let perm of role.permissions">
                      <td style="font-weight: 600;">{{ getModuleName(perm.module) }}</td>
                      <td><mat-slide-toggle color="primary" [(ngModel)]="perm.canRead" (change)="updatePermission(role.id, perm)"></mat-slide-toggle></td>
                      <td><mat-slide-toggle color="primary" [(ngModel)]="perm.canCreate" (change)="updatePermission(role.id, perm)"></mat-slide-toggle></td>
                      <td><mat-slide-toggle color="primary" [(ngModel)]="perm.canUpdate" (change)="updatePermission(role.id, perm)"></mat-slide-toggle></td>
                      <td><mat-slide-toggle color="primary" [(ngModel)]="perm.canDelete" (change)="updatePermission(role.id, perm)"></mat-slide-toggle></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- ── Credentials Tab (SUPERADMIN only) ── -->
        <mat-tab *ngIf="isSuperAdmin()" label="{{ isAr() ? '🔑 بيانات الاعتماد' : '🔑 Credentials' }}">
          <div style="margin-top:24px;padding-bottom:40px">
            <!-- Search -->
            <div class="cred-toolbar">
              <div class="cred-search-wrap">
                <mat-icon>search</mat-icon>
                <input class="cred-search" [(ngModel)]="credSearch"
                  [placeholder]="isAr() ? 'بحث باسم أو اسم مستخدم...' : 'Search by name or username...'"
                  (input)="applyCredSearch()">
              </div>
              <span class="cred-count">{{ filteredCreds().length }} {{ isAr() ? 'مستخدم' : 'users' }}</span>
            </div>

            <div class="cred-loading" *ngIf="credsLoading()">
              <mat-spinner diameter="36"></mat-spinner>
            </div>

            <div class="table-responsive" *ngIf="!credsLoading()">
              <table class="cred-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{{ isAr() ? 'كود الموظف' : 'Emp. Code' }}</th>
                    <th>{{ isAr() ? 'الاسم' : 'Name' }}</th>
                    <th>{{ isAr() ? 'القسم' : 'Department' }}</th>
                    <th>{{ isAr() ? 'الدور' : 'Role' }}</th>
                    <th>{{ isAr() ? 'اسم المستخدم' : 'Username' }}</th>
                    <th>{{ isAr() ? 'كلمة السر' : 'Password' }}</th>
                    <th>{{ isAr() ? 'البريد' : 'Email' }}</th>
                    <th>{{ isAr() ? 'الهاتف' : 'Phone' }}</th>
                    <th>{{ isAr() ? 'الحالة' : 'Status' }}</th>
                    <th>{{ isAr() ? 'آخر دخول' : 'Last Login' }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let u of filteredCreds(); let i = index" [class.inactive-row]="!u.isActive">
                    <td class="num-cell">{{ i + 1 }}</td>
                    <td><span class="emp-code">{{ u.employeeCode }}</span></td>
                    <td>
                      <div class="name-cell">
                        <div class="mini-av">{{ (isAr() ? u.fullNameAr : u.fullName)?.charAt(0) }}</div>
                        <div>
                          <div style="font-weight:600;font-size:13px">{{ isAr() ? u.fullNameAr : u.fullName }}</div>
                          <div style="font-size:11px;color:var(--text-muted)">{{ u.email }}</div>
                        </div>
                      </div>
                    </td>
                    <td>{{ isAr() ? u.department?.nameAr : u.department?.name }}</td>
                    <td>
                      <span class="role-pill" [class]="'lvl-' + u.role?.level">
                        {{ isAr() ? u.role?.nameAr : u.role?.name }}
                      </span>
                    </td>
                    <td><code class="cred-val">{{ u.username }}</code></td>
                    <td>
                      <div class="pass-cell">
                        <code class="cred-val" [class.hidden-pass]="!showPassMap[u.id]">
                          {{ showPassMap[u.id] ? (u.plainPassword || '— غير متاح —') : '••••••••' }}
                        </code>
                        <button class="eye-btn" (click)="togglePass(u.id)"
                          [matTooltip]="showPassMap[u.id] ? 'إخفاء' : 'إظهار'">
                          <mat-icon style="font-size:15px">{{ showPassMap[u.id] ? 'visibility_off' : 'visibility' }}</mat-icon>
                        </button>
                      </div>
                    </td>
                    <td style="font-size:12px">{{ u.email }}</td>
                    <td style="font-size:12px">{{ u.phone || '—' }}</td>
                    <td>
                      <span class="status-dot" [class.active]="u.isActive">{{ u.isActive ? (isAr() ? 'نشط' : 'Active') : (isAr() ? 'غير نشط' : 'Inactive') }}</span>
                    </td>
                    <td style="font-size:11px;color:var(--text-muted)">
                      {{ u.lastLoginAt ? (u.lastLoginAt | date:'dd/MM/yy HH:mm') : '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </mat-tab>

        <!-- ── Webhooks Tab (SUPERADMIN only) ── -->
        <mat-tab *ngIf="isSuperAdmin()" label="{{ isAr() ? '🔗 ربط خارجي (Webhooks)' : '🔗 Webhooks' }}">
          <div style="margin-top:24px;padding-bottom:40px">
            <div class="cred-toolbar">
              <button mat-flat-button color="primary" class="tf-btn-primary" (click)="newWebhook()">
                <mat-icon>add</mat-icon> {{ isAr() ? 'إضافة Webhook' : 'Add Webhook' }}
              </button>
            </div>

            <div class="settings-grid" *ngIf="webhooks.length > 0">
              <div class="settings-card premium-glass" *ngFor="let hook of webhooks" style="position: relative;">
                <div style="position: absolute; top: 16px; right: 16px; display: flex; gap: 8px;">
                  <button mat-icon-button color="warn" (click)="deleteWebhook(hook.id)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
                <h3 class="card-title" style="margin-bottom: 8px;">
                  <mat-icon>webhook</mat-icon> {{ hook.name }}
                </h3>
                <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">{{ hook.url }}</p>
                
                <div style="font-size: 13px; margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 6px;">
                  <span class="role-pill lvl-4" *ngFor="let ev of hook.eventTypes.split(',')">{{ ev }}</span>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:12px;">
                  <span style="font-size: 12px; color: var(--text-muted)">
                    {{ hook.isActive ? (isAr() ? 'مفعل' : 'Active') : (isAr() ? 'معطل' : 'Disabled') }}
                  </span>
                  <mat-slide-toggle color="primary" [(ngModel)]="hook.isActive" (change)="updateWebhook(hook)"></mat-slide-toggle>
                </div>
              </div>
            </div>

            <div *ngIf="webhooks.length === 0" style="text-align: center; padding: 60px; color: var(--text-muted);">
              <mat-icon style="font-size: 48px; width: 48px; height: 48px; opacity: 0.5;">webhook</mat-icon>
              <p style="margin-top: 16px; font-size: 16px;">{{ isAr() ? 'لا توجد Webhooks مضافة' : 'No Webhooks found' }}</p>
            </div>
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
  styles: [`
    .settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 24px; padding-bottom: 40px; }
    .premium-glass {
      background: rgba(var(--bg-card-rgb), 0.7);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(var(--border-rgb), 0.5);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.05);
    }
    .card-title { display: flex; align-items: center; gap: 8px; font-size: 18px; margin-bottom: 24px; color: var(--text-main);
      mat-icon { color: var(--color-primary); }
    }
    .tf-full-width { width: 100%; margin-bottom: 16px; }
    .loading-center { display: flex; justify-content: center; padding: 100px; }

    .table-responsive { overflow-x: auto; }
    .tf-table {
      width: 100%; border-collapse: collapse; text-align: start;
      th { padding: 12px 16px; background: rgba(var(--text-main-rgb), 0.03); color: var(--text-secondary); font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid var(--border-color); }
      td { padding: 12px 16px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
      tr:last-child td { border-bottom: none; }
    }

    /* ── Credentials Table ── */
    .cred-toolbar {
      display: flex; align-items: center; gap: 16px;
      margin-bottom: 16px; flex-wrap: wrap;
    }
    .cred-search-wrap {
      display: flex; align-items: center; gap: 8px; flex: 1;
      background: var(--bg-card); border: 1px solid var(--border-color);
      border-radius: 10px; padding: 8px 14px;
      mat-icon { color: var(--text-muted); font-size: 18px; }
    }
    .cred-search {
      border: none; outline: none; background: transparent;
      color: var(--text-primary); font-size: 13px; flex: 1;
    }
    .cred-count { font-size: 12px; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
    .cred-loading { display: flex; justify-content: center; padding: 40px; }

    .cred-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      min-width: 1000px;
      th {
        padding: 11px 12px; background: var(--bg-main);
        color: var(--text-muted); font-size: 11px; font-weight: 700;
        text-transform: uppercase; border-bottom: 2px solid var(--border-color);
        white-space: nowrap; text-align: start;
      }
      td { padding: 10px 12px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
      tr:hover td { background: var(--bg-main); }
      tr:last-child td { border-bottom: none; }
    }
    .inactive-row td { opacity: 0.5; }
    .num-cell { color: var(--text-muted); font-size: 12px; width: 32px; }
    .emp-code { font-family: monospace; font-size: 11px; background: var(--bg-main); padding: 2px 8px; border-radius: 4px; }
    .name-cell { display: flex; align-items: center; gap: 10px; min-width: 180px; }
    .mini-av {
      width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #f97316, #ea580c); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
    }
    .role-pill {
      font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 20px;
      &.lvl-1 { background: rgba(239,68,68,0.12); color: #ef4444; }
      &.lvl-2 { background: rgba(249,115,22,0.12); color: #f97316; }
      &.lvl-3 { background: rgba(59,130,246,0.12); color: #3b82f6; }
      &.lvl-4 { background: rgba(100,116,139,0.12); color: #64748b; }
    }
    .cred-val { font-family: monospace; font-size: 13px; color: var(--text-primary); }
    .hidden-pass { color: var(--text-muted); letter-spacing: 2px; }
    .pass-cell { display: flex; align-items: center; gap: 6px; }
    .eye-btn {
      background: none; border: none; cursor: pointer; color: var(--text-muted);
      padding: 2px; display: flex; align-items: center; border-radius: 4px;
      transition: color 0.15s;
      &:hover { color: var(--color-primary); }
    }
    .status-dot {
      font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 20px;
      background: rgba(239,68,68,0.1); color: #ef4444;
      &.active { background: rgba(34,197,94,0.1); color: #22c55e; }
    }
  `]
})
export class SettingsComponent implements OnInit {
  loading    = signal(true);
  saving     = signal(false);
  credsLoading = signal(false);
  settings: Record<string, string> = {};
  roles: any[] = [];
  credentials: any[] = [];
  filteredCreds = signal<any[]>([]);
  credSearch = '';
  showPassMap: Record<number, boolean> = {};
  webhooks: any[] = [];

  isAr = () => this.langService.getCurrentLang() === 'ar';
  isSuperAdmin = () => (this.authService.currentUser()?.role?.level ?? 99) <= 1;

  constructor(
    private http: HttpClient,
    private langService: LangService,
    private authService: AuthService,
    private snack: MatSnackBar
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.loadCount = 0;
    // Load Settings
    this.http.get<any>(`${environment.apiUrl}/settings`).subscribe({
      next: (res) => { if (res.success) this.settings = res.data; this.checkDone(); },
      error: () => this.checkDone()
    });

    // Load Roles
    this.http.get<any>(`${environment.apiUrl}/settings/roles/permissions`).subscribe({
      next: (res) => { if (res.success) this.roles = res.data; this.checkDone(); },
      error: () => this.checkDone()
    });

    // Load Credentials (SUPERADMIN only)
    if (this.isSuperAdmin()) {
      this.credsLoading.set(true);
      this.http.get<any>(`${environment.apiUrl}/users/credentials`).subscribe({
        next: (res) => {
          this.credsLoading.set(false);
          if (res.success) {
            this.credentials = res.data;
            this.filteredCreds.set(res.data);
          }
        },
        error: () => this.credsLoading.set(false),
      });

      this.loadWebhooks();
    }
  }

  loadWebhooks() {
    this.http.get<any>(`${environment.apiUrl}/webhooks`).subscribe(res => {
      if (res.success) this.webhooks = res.data;
    });
  }

  newWebhook() {
    const name = prompt(this.isAr() ? 'اسم النظام الخارجي (مثال: ERP System)' : 'Webhook Name (e.g., ERP System)');
    if (!name) return;
    const url = prompt(this.isAr() ? 'رابط الاستقبال (URL)' : 'Webhook URL');
    if (!url) return;
    const secret = prompt(this.isAr() ? '(اختياري) رمز سري للتشفير (Secret)' : '(Optional) Secret for signing');
    
    // For simplicity, hardcode to listen to TASK_CREATED, TASK_UPDATED, TASK_STATUS_CHANGED.
    // Ideally this would be a multi-select dialog, but prompt is quicker for now.
    const eventTypes = 'TASK_CREATED,TASK_UPDATED,TASK_STATUS_CHANGED';

    this.http.post<any>(`${environment.apiUrl}/webhooks`, { name, url, secret, eventTypes, isActive: true }).subscribe({
      next: (res) => {
        if (res.success) {
          this.webhooks.unshift(res.data);
          this.snack.open(this.isAr() ? 'تم إضافة Webhook' : 'Webhook added', 'OK', { duration: 2000 });
        }
      }
    });
  }

  updateWebhook(hook: any) {
    this.http.put<any>(`${environment.apiUrl}/webhooks/${hook.id}`, hook).subscribe();
  }

  deleteWebhook(id: number) {
    if (!confirm(this.isAr() ? 'هل أنت متأكد من الحذف؟' : 'Are you sure?')) return;
    this.http.delete<any>(`${environment.apiUrl}/webhooks/${id}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.webhooks = this.webhooks.filter(h => h.id !== id);
          this.snack.open(this.isAr() ? 'تم الحذف' : 'Deleted', 'OK', { duration: 2000 });
        }
      }
    });
  }

  private loadCount = 0;
  checkDone() {
    this.loadCount++;
    if (this.loadCount >= 2) {
      this.loading.set(false);
      this.loadCount = 0;
    }
  }

  getModuleName(mod: string): string {
    const mapAr: any = { 'USERS': 'الموظفين', 'TASKS': 'المهام', 'DEPARTMENTS': 'الأقسام', 'REPORTS': 'التقارير', 'AUDIT': 'سجل الحركات' };
    const mapEn: any = { 'USERS': 'Employees', 'TASKS': 'Tasks', 'DEPARTMENTS': 'Departments', 'REPORTS': 'Reports', 'AUDIT': 'Audit Logs' };
    return this.isAr() ? (mapAr[mod] || mod) : (mapEn[mod] || mod);
  }

  applyCredSearch() {
    const s = this.credSearch.toLowerCase().trim();
    if (!s) { this.filteredCreds.set(this.credentials); return; }
    this.filteredCreds.set(this.credentials.filter(u =>
      u.fullName?.toLowerCase().includes(s) ||
      u.fullNameAr?.toLowerCase().includes(s) ||
      u.username?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.employeeCode?.toLowerCase().includes(s)
    ));
  }

  togglePass(userId: number) {
    this.showPassMap = { ...this.showPassMap, [userId]: !this.showPassMap[userId] };
  }

  updatePermission(roleId: number, perm: any) {
    this.http.put<any>(`${environment.apiUrl}/settings/roles/${roleId}/permissions/${perm.id}`, perm).subscribe({
      next: () => {
        this.snack.open(this.isAr() ? 'تم تحديث الصلاحية' : 'Permission updated', 'OK', { duration: 2000 });
      },
      error: (err) => {
        this.snack.open(err.error?.message || 'Error updating permission', 'OK', { duration: 3000 });
      }
    });
  }

  saveAll() {
    this.saving.set(true);
    const keys = Object.keys(this.settings);
    let completed = 0;
    if (keys.length === 0) { this.saving.set(false); return; }
    keys.forEach(key => {
      this.http.put<any>(`${environment.apiUrl}/settings/${key}`, { value: String(this.settings[key]) }).subscribe({
        next: () => {
          completed++;
          if (completed === keys.length) {
            this.saving.set(false);
            this.snack.open(this.isAr() ? 'تم الحفظ بنجاح' : 'Saved successfully', 'OK', { duration: 3000 });
          }
        },
        error: () => { completed++; if (completed === keys.length) this.saving.set(false); }
      });
    });
  }
}
