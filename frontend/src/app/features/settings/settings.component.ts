import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LangService } from '../../core/services/lang.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MatIconModule, MatButtonModule, MatInputModule, MatFormFieldModule, MatSelectModule, MatProgressSpinnerModule, MatTabsModule, MatSlideToggleModule],
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
  `]
})
export class SettingsComponent implements OnInit {
  loading = signal(true);
  saving = signal(false);
  settings: Record<string, string> = {};
  roles: any[] = [];
  isAr = () => this.langService.getCurrentLang() === 'ar';

  constructor(private http: HttpClient, private langService: LangService, private snack: MatSnackBar) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
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

    if (keys.length === 0) {
      this.saving.set(false);
      return;
    }

    keys.forEach(key => {
      this.http.put<any>(`${environment.apiUrl}/settings/${key}`, { value: String(this.settings[key]) }).subscribe({
        next: () => {
          completed++;
          if (completed === keys.length) {
            this.saving.set(false);
            this.snack.open(this.isAr() ? 'تم الحفظ بنجاح' : 'Saved successfully', 'OK', { duration: 3000 });
          }
        },
        error: () => {
          completed++;
          if (completed === keys.length) this.saving.set(false);
        }
      });
    });
  }
}
