import { Component, OnInit, signal, ViewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { LangService } from '../../core/services/lang.service';
import { environment } from '../../../environments/environment';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTabsModule, TranslateModule, BaseChartDirective],
  template: `
    <div class="page-container fade-in">
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div class="page-title">
          <h1>{{ 'REPORTS.TITLE' | translate }}</h1>
          <p>{{ isAr() ? 'التقارير والتحليلات المتقدمة' : 'Advanced Analytics & Reports' }}</p>
        </div>
        <button mat-flat-button color="primary" class="tf-btn-primary" (click)="exportToCsv()">
          <mat-icon>download</mat-icon>
          {{ isAr() ? 'تصدير التقرير' : 'Export Report' }}
        </button>
      </div>

      <div *ngIf="loading()" class="loading-center">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <div *ngIf="!loading()" class="reports-grid">
        <!-- KPI Cards -->
        <div class="kpi-cards">
          <div class="kpi-card premium-glass">
            <div class="kpi-icon total"><mat-icon>assignment</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">{{ isAr() ? 'إجمالي المهام' : 'Total Tasks' }}</span>
              <span class="kpi-value">{{ totalStats().assigned }}</span>
            </div>
          </div>
          <div class="kpi-card premium-glass">
            <div class="kpi-icon completed"><mat-icon>check_circle</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">{{ 'REPORTS.COMPLETED' | translate }}</span>
              <span class="kpi-value">{{ totalStats().completed }}</span>
            </div>
          </div>
          <div class="kpi-card premium-glass">
            <div class="kpi-icon overdue"><mat-icon>warning</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">{{ 'REPORTS.OVERDUE' | translate }}</span>
              <span class="kpi-value">{{ totalStats().overdue }}</span>
            </div>
          </div>
          <div class="kpi-card premium-glass">
            <div class="kpi-icon rate"><mat-icon>trending_up</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">{{ 'REPORTS.COMPLETION_RATE' | translate }}</span>
              <span class="kpi-value">{{ totalStats().completionRate }}%</span>
            </div>
          </div>
        </div>

        <div class="charts-row">
          <!-- Department Performance Bar Chart -->
          <div class="chart-card premium-glass">
            <h3 class="chart-title">{{ isAr() ? 'أداء الأقسام' : 'Departments Performance' }}</h3>
            <div class="chart-container">
              <canvas baseChart
                [data]="barChartData()"
                [options]="barChartOptions"
                [type]="'bar'">
              </canvas>
            </div>
          </div>

          <!-- Overall Status Doughnut Chart -->
          <div class="chart-card premium-glass">
            <h3 class="chart-title">{{ isAr() ? 'توزيع الحالات' : 'Status Distribution' }}</h3>
            <div class="chart-container">
              <canvas baseChart
                [data]="doughnutChartData()"
                [options]="doughnutChartOptions"
                [type]="'doughnut'">
              </canvas>
            </div>
          </div>
        </div>

        <mat-tab-group class="premium-tabs premium-glass">
          <mat-tab [label]="isAr() ? 'تفاصيل الأقسام' : 'Department Details'">
            <div class="table-container">
              <table class="premium-table">
                <thead>
                  <tr>
                    <th>{{ isAr() ? 'القسم' : 'Department' }}</th>
                    <th>{{ isAr() ? 'الموظفون' : 'Employees' }}</th>
                    <th>{{ 'REPORTS.ASSIGNED' | translate }}</th>
                    <th>{{ 'REPORTS.COMPLETED' | translate }}</th>
                    <th>{{ 'REPORTS.OVERDUE' | translate }}</th>
                    <th>{{ 'REPORTS.COMPLETION_RATE' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let d of deptReport()">
                    <td class="fw-600">{{ isAr() ? d.nameAr : d.name }}</td>
                    <td>{{ d.employeeCount }}</td>
                    <td>{{ d.assigned }}</td>
                    <td><span class="badge success">{{ d.completed }}</span></td>
                    <td><span class="badge" [class.danger]="d.overdue > 0" [class.neutral]="d.overdue === 0">{{ d.overdue }}</span></td>
                    <td>
                      <div class="progress-wrapper">
                        <div class="tf-progress"><div class="tf-progress__fill" [style.width]="d.completionRate + '%'"></div></div>
                        <span class="rate-text">{{ d.completionRate }}%</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </mat-tab>

          <mat-tab [label]="isAr() ? 'المهام المتأخرة' : 'Overdue Tasks'">
            <div class="table-container">
              <table class="premium-table">
                <thead>
                  <tr>
                    <th>{{ isAr() ? 'الكود' : 'Code' }}</th>
                    <th>{{ isAr() ? 'العنوان' : 'Title' }}</th>
                    <th>{{ 'TASKS.ASSIGNED_TO' | translate }}</th>
                    <th>{{ isAr() ? 'الموعد النهائي' : 'Due Date' }}</th>
                    <th>{{ isAr() ? 'أيام التأخير' : 'Days Late' }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let t of overdueReport()">
                    <td><span class="code-badge">{{ t.taskCode }}</span></td>
                    <td class="fw-600">{{ isAr() && t.titleAr ? t.titleAr : t.title }}</td>
                    <td>
                      <div class="user-cell">
                        <div class="avatar">{{ getInitials(isAr() ? t.assignedTo?.fullNameAr : t.assignedTo?.fullName) }}</div>
                        <span>{{ isAr() ? t.assignedTo?.fullNameAr : t.assignedTo?.fullName }}</span>
                      </div>
                    </td>
                    <td class="danger-text">{{ t.dueDate | date:'dd/MM/yyyy' }}</td>
                    <td><span class="badge danger pulse-danger">{{ getDaysLate(t.dueDate) }} {{ isAr() ? 'يوم' : 'Days' }}</span></td>
                  </tr>
                  <tr *ngIf="overdueReport()?.length === 0">
                    <td colspan="5" class="empty-state">
                      <mat-icon>celebration</mat-icon>
                      <p>{{ isAr() ? 'لا توجد مهام متأخرة!' : 'No overdue tasks!' }}</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </mat-tab>
          <mat-tab [label]="isAr() ? 'تقارير المستخلصات' : 'Extracts Reports'">
            <div *ngIf="extractReport()" style="padding: 20px;">
              <!-- Extracts KPIs -->
              <div class="kpi-cards" style="margin-bottom: 24px;">
                <div class="kpi-card premium-glass">
                  <div class="kpi-icon total"><mat-icon>receipt_long</mat-icon></div>
                  <div class="kpi-info">
                    <span class="kpi-label">{{ isAr() ? 'إجمالي المستخلصات' : 'Total Extracts' }}</span>
                    <span class="kpi-value">{{ extractReport()?.totalExtracts || 0 }}</span>
                  </div>
                </div>
                <div class="kpi-card premium-glass">
                  <div class="kpi-icon completed"><mat-icon>payments</mat-icon></div>
                  <div class="kpi-info">
                    <span class="kpi-label">{{ isAr() ? 'القيمة الإجمالية' : 'Total Amount' }}</span>
                    <span class="kpi-value">{{ extractReport()?.totalAmount | number:'1.0-0' }}</span>
                  </div>
                </div>
                <div class="kpi-card premium-glass">
                  <div class="kpi-icon rate"><mat-icon>timer</mat-icon></div>
                  <div class="kpi-info">
                    <span class="kpi-label">{{ isAr() ? 'متوسط وقت المراجعة (ساعة)' : 'Avg Review Time (hrs)' }}</span>
                    <span class="kpi-value">{{ extractReport()?.avgReviewHours || 0 }}</span>
                  </div>
                </div>
              </div>

              <div class="page-header" style="display: flex; justify-content: flex-end; margin-bottom: 15px;">
                <button mat-stroked-button color="primary" (click)="exportExtractsToCsv()">
                  <mat-icon>download</mat-icon>
                  {{ isAr() ? 'تصدير التقرير (Excel)' : 'Export Report (Excel)' }}
                </button>
              </div>

              <!-- Extracts Table -->
              <div class="table-container">
                <table class="premium-table">
                  <thead>
                    <tr>
                      <th>{{ isAr() ? 'المقاول' : 'Contractor' }}</th>
                      <th>{{ isAr() ? 'إجمالي المستخلصات' : 'Total Extracts' }}</th>
                      <th>{{ isAr() ? 'المُرحلة' : 'Posted' }}</th>
                      <th>{{ isAr() ? 'المُرجعة' : 'Returned' }}</th>
                      <th>{{ isAr() ? 'إجمالي المبالغ' : 'Total Amount' }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let c of extractReport()?.contractorStats">
                      <td class="fw-600">{{ c.contractorName }}</td>
                      <td>{{ c.total }}</td>
                      <td><span class="badge success">{{ c.posted }}</span></td>
                      <td><span class="badge danger" *ngIf="c.returned > 0">{{ c.returned }}</span><span class="badge neutral" *ngIf="c.returned === 0">0</span></td>
                      <td class="fw-600">{{ c.totalAmount | number:'1.0-0' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    </div>
  `,
  styles: [`
    .reports-grid { display: flex; flex-direction: column; gap: 24px; padding-bottom: 30px; }
    
    .premium-glass {
      background: rgba(var(--bg-card-rgb), 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(var(--border-rgb), 0.5);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.05);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .kpi-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
    .kpi-card { display: flex; align-items: center; padding: 24px; gap: 20px;
      &:hover { transform: translateY(-5px); box-shadow: 0 12px 40px rgba(0,0,0,0.08); }
    }
    .kpi-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 28px; width: 28px; height: 28px; }
      &.total { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
      &.completed { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
      &.overdue { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
      &.rate { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
    }
    .kpi-info { display: flex; flex-direction: column; gap: 4px; }
    .kpi-label { font-size: 14px; color: var(--text-muted); font-weight: 500; }
    .kpi-value { font-size: 28px; font-weight: 800; color: var(--text-main); line-height: 1; }

    .charts-row { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; 
      @media (max-width: 1024px) { grid-template-columns: 1fr; }
    }
    .chart-card { padding: 24px; display: flex; flex-direction: column; }
    .chart-title { margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: var(--text-main); }
    .chart-container { position: relative; height: 300px; width: 100%; display: flex; justify-content: center; }

    .premium-tabs { border-radius: 16px; overflow: hidden; margin-top: 10px; }
    ::ng-deep .premium-tabs .mat-mdc-tab-header { border-bottom: 1px solid rgba(var(--border-rgb), 0.5); background: rgba(var(--bg-main-rgb), 0.3); }

    .table-container { overflow-x: auto; padding: 20px; }
    .premium-table { width: 100%; min-width: 800px; border-collapse: separate; border-spacing: 0 8px;
      th { padding: 12px 16px; text-align: start; font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: none; }
      td { padding: 16px; background: rgba(var(--bg-main-rgb), 0.4); border: none; font-size: 14px; color: var(--text-main);
        &:first-child { border-radius: 8px 0 0 8px; }
        &:last-child { border-radius: 0 8px 8px 0; }
      }
      tr:hover td { background: rgba(var(--bg-main-rgb), 0.8); }
    }
    html[dir="rtl"] .premium-table td {
      &:first-child { border-radius: 0 8px 8px 0; }
      &:last-child { border-radius: 8px 0 0 8px; }
    }

    .fw-600 { font-weight: 600; }
    .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
    .badge.success { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
    .badge.danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
    .badge.neutral { background: rgba(100, 116, 139, 0.1); color: #64748b; }
    .code-badge { background: rgba(var(--primary-rgb), 0.1); color: var(--primary); padding: 4px 8px; border-radius: 6px; font-family: monospace; font-weight: 600; font-size: 13px; }
    .danger-text { color: #ef4444; font-weight: 500; }
    
    .progress-wrapper { display: flex; align-items: center; gap: 12px; }
    .tf-progress { flex: 1; height: 8px; background: rgba(var(--border-rgb), 0.5); border-radius: 4px; overflow: hidden; }
    .tf-progress__fill { height: 100%; background: linear-gradient(90deg, var(--primary), #8b5cf6); border-radius: 4px; transition: width 1s ease-out; }
    .rate-text { font-weight: 600; font-size: 13px; min-width: 40px; }

    .user-cell { display: flex; align-items: center; gap: 10px; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #8b5cf6); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }

    .empty-state { text-align: center; padding: 40px; color: var(--text-muted);
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5; }
      p { font-size: 16px; font-weight: 500; }
    }

    .pulse-danger { animation: pulse-red 2s infinite; }
    @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
    .loading-center { display: flex; justify-content: center; padding: 100px; }
  `],
})
export class ReportsComponent implements OnInit {
  loading = signal(true);
  deptReport = signal<any[]>([]);
  overdueReport = signal<any[]>([]);
  extractReport = signal<any>(null);

  isAr = () => this.langService.getCurrentLang() === 'ar';

  totalStats = computed(() => {
    const deps = this.deptReport();
    let assigned = 0, completed = 0, overdue = 0;
    deps.forEach(d => { assigned += d.assigned; completed += d.completed; overdue += d.overdue; });
    const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
    return { assigned, completed, overdue, completionRate };
  });

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#888', font: { family: 'Cairo' } } },
      tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleFont: { family: 'Cairo' }, bodyFont: { family: 'Cairo' } }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(200,200,200,0.1)' }, ticks: { color: '#888' } },
      x: { grid: { display: false }, ticks: { color: '#888', font: { family: 'Cairo' } } }
    }
  };

  doughnutChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#888', font: { family: 'Cairo' } } },
      tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleFont: { family: 'Cairo' }, bodyFont: { family: 'Cairo' } }
    },
    cutout: '75%'
  };

  barChartData = computed<ChartData<'bar'>>(() => {
    const deps = this.deptReport();
    return {
      labels: deps.map(d => this.isAr() ? d.nameAr : d.name),
      datasets: [
        { data: deps.map(d => d.completed), label: this.isAr() ? 'مكتملة' : 'Completed', backgroundColor: '#22c55e', borderRadius: 4 },
        { data: deps.map(d => d.assigned - d.completed - d.overdue), label: this.isAr() ? 'قيد التنفيذ' : 'In Progress', backgroundColor: '#3b82f6', borderRadius: 4 },
        { data: deps.map(d => d.overdue), label: this.isAr() ? 'متأخرة' : 'Overdue', backgroundColor: '#ef4444', borderRadius: 4 }
      ]
    };
  });

  doughnutChartData = computed<ChartData<'doughnut'>>(() => {
    const stats = this.totalStats();
    const inProgress = stats.assigned - stats.completed - stats.overdue;
    return {
      labels: [this.isAr() ? 'مكتملة' : 'Completed', this.isAr() ? 'قيد التنفيذ' : 'In Progress', this.isAr() ? 'متأخرة' : 'Overdue'],
      datasets: [
        {
          data: [stats.completed, inProgress > 0 ? inProgress : 0, stats.overdue],
          backgroundColor: ['#22c55e', '#3b82f6', '#ef4444'],
          hoverBackgroundColor: ['#16a34a', '#2563eb', '#dc2626'],
          borderWidth: 0
        }
      ]
    };
  });

  constructor(private http: HttpClient, private langService: LangService) {}

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/reports/departments-summary`).subscribe(res => {
      if (res.success) { 
        this.deptReport.set(res.data);
        this.fetchOverdue();
      }
    });
  }

  fetchOverdue() {
    this.http.get<any>(`${environment.apiUrl}/reports/overdue`).subscribe(res => {
      if (res.success) this.overdueReport.set(res.data);
      this.fetchExtractsReport();
    });
  }

  fetchExtractsReport() {
    this.http.get<any>(`${environment.apiUrl}/reports/extracts`).subscribe({
      next: (res) => {
        if (res.success) this.extractReport.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  getDaysLate(dueDate: string): number {
    return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000));
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  exportToCsv() {
    const data = this.deptReport();
    if (!data || data.length === 0) return;
    
    let csv = this.isAr() 
      ? 'القسم,عدد الموظفين,إجمالي المهام المسندة,المهام المكتملة,المهام المتأخرة,نسبة الإنجاز\n'
      : 'Department,Employees,Assigned Tasks,Completed Tasks,Overdue Tasks,Completion Rate\n';
    
    data.forEach(d => {
      csv += `${this.isAr() ? d.nameAr : d.name},${d.employeeCount},${d.assigned},${d.completed},${d.overdue},${d.completionRate}%\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TaskFlow_Reports_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  exportExtractsToCsv() {
    const data = this.extractReport()?.contractorStats;
    if (!data || data.length === 0) return;
    
    let csv = this.isAr() 
      ? 'المقاول,إجمالي المستخلصات,المُرحلة,المُرجعة,إجمالي المبالغ\n'
      : 'Contractor,Total Extracts,Posted,Returned,Total Amount\n';
    
    data.forEach((d: any) => {
      csv += `${d.contractorName},${d.total},${d.posted},${d.returned},${d.totalAmount}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Extracts_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }
}
