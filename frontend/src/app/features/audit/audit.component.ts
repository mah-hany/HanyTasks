import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { LangService } from '../../core/services/lang.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatMenuModule, TranslateModule],
  template: `
    <div class="page-container fade-in">
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div class="page-title">
          <h1>{{ isAr() ? 'سجل التدقيق' : 'Audit Log' }}</h1>
          <p>{{ logs().length }} {{ isAr() ? 'سجل' : 'records' }}</p>
        </div>
        <div class="page-actions" *ngIf="authService.hasRoleLevel(1)">
          <button mat-stroked-button color="warn" [matMenuTriggerFor]="deleteMenu">
            <mat-icon>delete_sweep</mat-icon>
            {{ isAr() ? 'حذف السجلات' : 'Clear Logs' }}
          </button>
          <mat-menu #deleteMenu="matMenu">
            <button mat-menu-item (click)="deleteLogs('old')">
              <mat-icon color="warn">auto_delete</mat-icon>
              {{ isAr() ? 'حذف السجلات القديمة (أكثر من 30 يوم)' : 'Delete old logs (>30 days)' }}
            </button>
            <button mat-menu-item (click)="deleteLogs('all')">
              <mat-icon color="warn">delete_forever</mat-icon>
              {{ isAr() ? 'مسح كل السجلات' : 'Clear ALL logs' }}
            </button>
          </mat-menu>
        </div>
      </div>
      <div *ngIf="loading()" class="loading-center"><mat-spinner diameter="40"></mat-spinner></div>
      <div *ngIf="!loading()" class="tf-card" style="padding:0;overflow:hidden">
        <div class="table-responsive" style="overflow-x: auto;">
          <table class="task-table" style="width:100%; min-width: 600px;">
            <thead>
              <tr>
                <th>{{ isAr() ? 'المستخدم' : 'User' }}</th>
                <th>{{ isAr() ? 'العملية' : 'Action' }}</th>
                <th>{{ isAr() ? 'الجدول' : 'Table' }}</th>
                <th>{{ isAr() ? 'عنوان IP' : 'IP Address' }}</th>
                <th>{{ isAr() ? 'التاريخ' : 'Date' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of logs()">
                <td>{{ log.user?.fullName || (isAr() ? 'النظام' : 'System') }}</td>
                <td><span style="font-family:monospace;font-size:12px;color:var(--color-primary-light)">{{ log.action }}</span></td>
                <td><span style="font-size:12px;color:var(--text-muted)">{{ log.tableAffected }}</span></td>
                <td style="font-family:monospace;font-size:12px">{{ log.ipAddress }}</td>
                <td style="font-size:12px">{{ log.actionDate | date:'dd/MM/yyyy HH:mm:ss' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div *ngIf="logs().length === 0" class="empty-state">
          <mat-icon>history_toggle_off</mat-icon>
          <p>{{ isAr() ? 'لا توجد سجلات لعرضها' : 'No records to display' }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .task-table { width: 100%; border-collapse: collapse;
      th { padding: 10px 14px; font-size: 12px; font-weight: 700; color: var(--text-muted); background: var(--bg-main); border-bottom: 1px solid var(--border-color); text-align: inherit; }
      td { padding: 10px 14px; border-bottom: 1px solid var(--border-color); font-size: 13px; }
      tr:last-child td { border-bottom: none; }
    }
    .loading-center { display: flex; justify-content: center; padding: 80px; }
    .empty-state { text-align: center; padding: 40px; color: var(--text-muted);
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5; }
      p { font-size: 16px; font-weight: 500; margin: 0; }
    }
  `],
})
export class AuditComponent implements OnInit {
  logs = signal<any[]>([]);
  loading = signal(true);
  isAr = () => this.langService.getCurrentLang() === 'ar';

  constructor(
    private http: HttpClient, 
    private langService: LangService,
    public authService: AuthService,
    private snack: MatSnackBar
  ) {}

  ngOnInit() {
    this.loadLogs();
  }

  loadLogs() {
    this.loading.set(true);
    this.http.get<any>(`${environment.apiUrl}/audit`).subscribe({
      next: (res) => { this.loading.set(false); if (res.success) this.logs.set(res.data); },
      error: () => this.loading.set(false),
    });
  }

  deleteLogs(type: 'old' | 'all') {
    const msg = type === 'old' 
      ? (this.isAr() ? 'هل أنت متأكد من حذف السجلات القديمة؟' : 'Are you sure you want to delete old logs?')
      : (this.isAr() ? 'هل أنت متأكد من مسح جميع السجلات بالكامل؟ هذا الإجراء لا يمكن التراجع عنه!' : 'Are you sure you want to clear ALL logs? This cannot be undone!');
      
    if (confirm(msg)) {
      this.http.delete<any>(`${environment.apiUrl}/audit?type=${type}`).subscribe({
        next: (res) => {
          if (res.success) {
            this.snack.open(res.message || (this.isAr() ? 'تم الحذف بنجاح' : 'Deleted successfully'), 'OK', { duration: 3000 });
            this.loadLogs();
          }
        },
        error: (err) => {
          this.snack.open(err.error?.message || 'Error deleting logs', 'OK', { duration: 3000 });
        }
      });
    }
  }
}
