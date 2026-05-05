import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { TaskService } from '../../core/services/task.service';
import { AuthService } from '../../core/services/auth.service';
import { LangService } from '../../core/services/lang.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, TranslateModule, BaseChartDirective],
  template: `
    <div class="page-container fade-in">
      <!-- Header -->
      <div class="page-header">
        <div class="page-title">
          <h1>
            {{ 'DASHBOARD.WELCOME' | translate }},
            {{ isAr() ? user()?.fullNameAr : user()?.fullName }} 👋
          </h1>
          <p>{{ isAr() ? user()?.role?.nameAr : user()?.role?.name }} · {{ user()?.department?.name || 'No Department' }}</p>
        </div>
        <button mat-raised-button color="primary" routerLink="/tasks">
          <mat-icon>add</mat-icon>
          {{ 'TASKS.NEW_TASK' | translate }}
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="loading-center">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <ng-container *ngIf="!loading() && stats()">
        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card total" routerLink="/tasks">
            <div class="kpi-icon"><mat-icon>assignment</mat-icon></div>
            <div class="kpi-data">
              <div class="kpi-value">{{ stats()?.total }}</div>
              <div class="kpi-label">{{ 'DASHBOARD.TOTAL_TASKS' | translate }}</div>
            </div>
          </div>
          <div class="kpi-card active" routerLink="/tasks" [queryParams]="{status: 'IN_PROGRESS'}">
            <div class="kpi-icon"><mat-icon>autorenew</mat-icon></div>
            <div class="kpi-data">
              <div class="kpi-value">{{ stats()?.inProgress }}</div>
              <div class="kpi-label">{{ 'DASHBOARD.IN_PROGRESS' | translate }}</div>
            </div>
          </div>
          <div class="kpi-card done" routerLink="/tasks" [queryParams]="{status: 'COMPLETED'}">
            <div class="kpi-icon"><mat-icon>check_circle_outline</mat-icon></div>
            <div class="kpi-data">
              <div class="kpi-value">{{ stats()?.completedThisWeek }}</div>
              <div class="kpi-label">{{ 'DASHBOARD.COMPLETED_WEEK' | translate }}</div>
            </div>
          </div>
          <div class="kpi-card overdue" routerLink="/reports">
            <div class="kpi-icon"><mat-icon>warning_amber</mat-icon></div>
            <div class="kpi-data">
              <div class="kpi-value">{{ stats()?.overdue }}</div>
              <div class="kpi-label">{{ 'DASHBOARD.OVERDUE' | translate }}</div>
            </div>
          </div>
        </div>

        <!-- Charts + Recent Tasks -->
        <div class="dashboard-grid">
          <!-- Bar Chart: Monthly productivity -->
          <div class="tf-card chart-card">
            <div class="chart-header">
              <h3>{{ 'DASHBOARD.TEAM_PRODUCTIVITY' | translate }}</h3>
              <span class="chart-sub">آخر 6 أشهر / Last 6 months</span>
            </div>
            <div class="chart-wrapper">
              <canvas baseChart
                [data]="barChartData()"
                [options]="barOptions"
                type="bar">
              </canvas>
            </div>
          </div>

          <!-- Pie Chart: Status distribution -->
          <div class="tf-card chart-card chart-card--sm">
            <div class="chart-header">
              <h3>{{ 'DASHBOARD.STATUS_DISTRIBUTION' | translate }}</h3>
            </div>
            <div class="chart-wrapper chart-wrapper--pie">
              <canvas baseChart
                [data]="pieChartData()"
                [options]="pieOptions"
                type="doughnut">
              </canvas>
            </div>
          </div>
        </div>

        <!-- Recent Tasks -->
        <div class="tf-card recent-tasks-card">
          <div class="card-header-row">
            <h3>{{ 'DASHBOARD.RECENT_TASKS' | translate }}</h3>
            <a routerLink="/tasks" class="view-all-link">
              {{ 'COMMON.VIEW' | translate }} <mat-icon inline>arrow_forward</mat-icon>
            </a>
          </div>

          <div *ngIf="!stats()?.recentTasks?.length" class="empty-state">
            <mat-icon>task_alt</mat-icon>
            <p>{{ 'DASHBOARD.NO_TASKS' | translate }}</p>
          </div>

          <div class="task-list">
            <div class="task-row" *ngFor="let task of stats()?.recentTasks"
                 [routerLink]="['/tasks', task.id]">
              <div class="task-row-left">
                <span class="priority-chip" [class]="task.priority.toLowerCase()">
                  {{ isAr() ? getPriorityAr(task.priority) : task.priority }}
                </span>
                <div>
                  <div class="task-title">{{ isAr() && task.titleAr ? task.titleAr : task.title }}</div>
                  <div class="task-meta">
                    {{ task.taskCode }} · {{ isAr() ? task.assignedTo?.fullNameAr : task.assignedTo?.fullName }}
                  </div>
                </div>
              </div>
              <div class="task-row-right">
                <div class="tf-progress" style="width:100px">
                  <div class="tf-progress__fill" [style.width]="task.progressPercent + '%'"></div>
                </div>
                <span class="progress-pct">{{ task.progressPercent }}%</span>
                <span class="due-date" *ngIf="task.dueDate">
                  <mat-icon inline>schedule</mat-icon>
                  {{ task.dueDate | date:'dd/MM/yyyy' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 16px;
      margin-bottom: 24px;

      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    .chart-card {
      padding: 20px;
      .chart-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 16px;
        h3 { font-size: 15px; font-weight: 700; }
        .chart-sub { font-size: 12px; color: var(--text-muted); }
      }
    }

    .chart-wrapper { height: 240px; position: relative; }
    .chart-wrapper--pie { height: 220px; }

    .recent-tasks-card {
      padding: 20px;
      .card-header-row {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 16px;
        h3 { font-size: 15px; font-weight: 700; }
        .view-all-link {
          display: flex; align-items: center; gap: 2px;
          color: var(--color-primary-light); font-size: 13px; font-weight: 600;
          text-decoration: none;
          &:hover { text-decoration: underline; }
        }
      }
    }

    .empty-state {
      text-align: center; padding: 40px 20px; color: var(--text-muted);
      mat-icon { font-size: 48px; opacity: 0.3; }
      p { margin-top: 8px; }
    }

    .task-list { display: flex; flex-direction: column; gap: 2px; }

    .task-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px; border-radius: var(--radius-sm);
      cursor: pointer; transition: background var(--transition);
      &:hover { background: var(--bg-main); }

      .task-row-left {
        display: flex; align-items: center; gap: 12px;
        .task-title { font-size: 14px; font-weight: 600; }
        .task-meta  { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
      }

      .task-row-right {
        display: flex; align-items: center; gap: 10px; flex-shrink: 0;
        .progress-pct { font-size: 12px; font-weight: 700; color: var(--color-primary-light); min-width: 30px; }
        .due-date { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 2px; }
      }
    }

    .loading-center { display: flex; justify-content: center; padding: 80px; }
  `],
})
export class DashboardComponent implements OnInit {
  stats = signal<any>(null);
  loading = signal(true);

  user = () => this.authService.currentUser();
  isAr = () => this.langService.getCurrentLang() === 'ar';

  barOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  pieOptions: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { font: { family: 'Cairo', size: 11 } } } },
    cutout: '65%',
  };

  barChartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  pieChartData = signal<ChartData<'doughnut'>>({ labels: [], datasets: [] });

  constructor(
    private taskService: TaskService,
    private authService: AuthService,
    private langService: LangService,
  ) {}

  ngOnInit() {
    this.taskService.getDashboard().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.stats.set(res.data);
          this.buildCharts(res.data);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  buildCharts(data: any) {
    // Bar chart
    const months = data.monthlyData?.map((m: any) => m.month) || [];
    const counts = data.monthlyData?.map((m: any) => m.count) || [];
    this.barChartData.set({
      labels: months,
      datasets: [{
        data: counts, label: 'Completed',
        backgroundColor: 'rgba(46,134,171,0.7)',
        borderColor: '#2E86AB',
        borderWidth: 2, borderRadius: 6,
        hoverBackgroundColor: 'rgba(241,143,1,0.8)',
      }],
    });

    // Pie chart
    const statusColors: Record<string, string> = {
      NEW: '#94a3b8', IN_PROGRESS: '#3b82f6', UNDER_REVIEW: '#a855f7',
      REVISION_REQUIRED: '#f97316', COMPLETED: '#22c55e', CANCELLED: '#ef4444',
    };
    const statusLabelsAr: Record<string, string> = {
      NEW: 'جديدة', IN_PROGRESS: 'قيد التنفيذ', UNDER_REVIEW: 'تحت المراجعة',
      REVISION_REQUIRED: 'تحتاج تعديل', COMPLETED: 'مكتملة', CANCELLED: 'ملغاة',
    };
    const dist = data.statusDist || [];
    this.pieChartData.set({
      labels: dist.map((d: any) => this.isAr() ? statusLabelsAr[d.status] : d.status),
      datasets: [{
        data: dist.map((d: any) => d._count.id),
        backgroundColor: dist.map((d: any) => statusColors[d.status] || '#888'),
        borderWidth: 0,
        hoverOffset: 8,
      }],
    });
  }

  getPriorityAr(p: string): string {
    const m: Record<string, string> = { LOW: 'منخفض', MEDIUM: 'متوسط', HIGH: 'عالٍ', URGENT: 'عاجل' };
    return m[p] || p;
  }
}
