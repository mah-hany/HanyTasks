import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { TaskService } from '../../../core/services/task.service';
import { AuthService } from '../../../core/services/auth.service';
import { LangService } from '../../../core/services/lang.service';
import { TaskFormDialogComponent } from '../task-form-dialog/task-form-dialog.component';

const STATUS_COLUMNS = [
  { key: 'NEW',               labelAr: 'جديدة',             label: 'New',              color: '#94a3b8', icon: 'fiber_new' },
  { key: 'IN_PROGRESS',       labelAr: 'قيد التنفيذ',       label: 'In Progress',       color: '#3b82f6', icon: 'autorenew' },
  { key: 'UNDER_REVIEW',      labelAr: 'تحت المراجعة',      label: 'Under Review',      color: '#a855f7', icon: 'rate_review' },
  { key: 'REVISION_REQUIRED', labelAr: 'تحتاج تعديل',      label: 'Revision Required', color: '#f97316', icon: 'edit_note' },
  { key: 'COMPLETED',         labelAr: 'مكتملة',            label: 'Completed',         color: '#22c55e', icon: 'check_circle' },
];

@Component({
  selector: 'app-tasks-list',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatChipsModule,
    MatProgressSpinnerModule, MatTooltipModule, MatDialogModule, TranslateModule],
  template: `
    <div class="page-container fade-in">
      <!-- Header -->
      <div class="page-header">
        <div class="page-title">
          <h1>{{ 'TASKS.TITLE' | translate }}</h1>
          <p>{{ totalTasks() }} {{ isAr() ? 'مهمة' : 'tasks' }}</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <!-- View toggle -->
          <div class="view-toggle">
            <button [class.active]="view() === 'kanban'" (click)="view.set('kanban')" [matTooltip]="'TASKS.KANBAN_VIEW' | translate">
              <mat-icon>view_kanban</mat-icon>
            </button>
            <button [class.active]="view() === 'list'" (click)="view.set('list')" [matTooltip]="'TASKS.LIST_VIEW' | translate">
              <mat-icon>list</mat-icon>
            </button>
          </div>
          <!-- Export CSV -->
          <button mat-stroked-button (click)="exportCsv()" [matTooltip]="isAr() ? 'تصدير CSV' : 'Export CSV'">
            <mat-icon>download</mat-icon>
            {{ isAr() ? 'تصدير' : 'Export' }}
          </button>
          <!-- New Task -->
          <button mat-raised-button color="primary" (click)="openNewTask()" *ngIf="canCreate()">
            <mat-icon>add</mat-icon>
            {{ 'TASKS.NEW_TASK' | translate }}
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <mat-form-field appearance="outline" class="filter-search">
          <mat-label>{{ 'TASKS.SEARCH' | translate }}</mat-label>
          <input matInput [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-select">
          <mat-label>{{ 'TASKS.ALL_STATUS' | translate }}</mat-label>
          <mat-select [(ngModel)]="filterStatus" (ngModelChange)="applyFilters()">
            <mat-option value="">{{ 'TASKS.ALL_STATUS' | translate }}</mat-option>
            <mat-option *ngFor="let s of STATUS_COLUMNS" [value]="s.key">{{ isAr() ? s.labelAr : s.label }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-select">
          <mat-label>{{ 'TASKS.ALL_PRIORITY' | translate }}</mat-label>
          <mat-select [(ngModel)]="filterPriority" (ngModelChange)="applyFilters()">
            <mat-option value="">{{ 'TASKS.ALL_PRIORITY' | translate }}</mat-option>
            <mat-option value="URGENT">{{ isAr() ? 'عاجل' : 'Urgent' }}</mat-option>
            <mat-option value="HIGH">{{ isAr() ? 'عالٍ' : 'High' }}</mat-option>
            <mat-option value="MEDIUM">{{ isAr() ? 'متوسط' : 'Medium' }}</mat-option>
            <mat-option value="LOW">{{ isAr() ? 'منخفض' : 'Low' }}</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="loading-center"><mat-spinner diameter="40"></mat-spinner></div>

      <!-- Kanban View -->
      <div *ngIf="!loading() && view() === 'kanban'" class="kanban-board">
        <div *ngFor="let col of STATUS_COLUMNS" class="kanban-column">
          <div class="column-header" [style.color]="col.color">
            <div style="display:flex;align-items:center;gap:8px">
              <mat-icon style="font-size:18px">{{ col.icon }}</mat-icon>
              <span>{{ isAr() ? col.labelAr : col.label }}</span>
            </div>
            <span class="column-count">{{ getTasksByStatus(col.key).length }}</span>
          </div>

          <div *ngIf="!getTasksByStatus(col.key).length" class="column-empty">
            <mat-icon>inbox</mat-icon>
            <p>{{ isAr() ? 'لا توجد مهام' : 'No tasks' }}</p>
          </div>

          <div class="task-card-kanban" *ngFor="let task of getTasksByStatus(col.key)"
               [routerLink]="['/tasks', task.id]">
            <div class="kanban-task-header">
              <span class="priority-chip" [class]="task.priority.toLowerCase()">{{ getPriorityLabel(task.priority) }}</span>
              <span class="task-code-badge">{{ task.taskCode }}</span>
            </div>
            <div class="kanban-task-title">{{ isAr() && task.titleAr ? task.titleAr : task.title }}</div>
            <div class="kanban-task-footer">
              <div class="avatar-group" *ngIf="task.assignedTo">
                <div class="mini-avatar" [matTooltip]="isAr() ? task.assignedTo?.fullNameAr : task.assignedTo?.fullName">
                  {{ getInitial(isAr() ? task.assignedTo?.fullNameAr : task.assignedTo?.fullName) }}
                </div>
              </div>
              <div class="tf-progress" style="flex:1">
                <div class="tf-progress__fill" [style.width]="task.progressPercent + '%'"></div>
              </div>
              <span style="font-size:11px;font-weight:700;color:var(--color-primary-light)">{{ task.progressPercent }}%</span>
            </div>
            <div class="due-info" *ngIf="task.dueDate">
              <mat-icon inline style="font-size:12px">schedule</mat-icon>
              <span [style.color]="isOverdue(task) ? '#dc2626' : 'var(--text-muted)'">
                {{ task.dueDate | date:'dd/MM/yyyy' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- List View -->
      <div *ngIf="!loading() && view() === 'list'" class="tf-card list-view">
        <div *ngIf="!filteredTasks().length" class="empty-state">
          <mat-icon>task</mat-icon>
          <p>{{ 'TASKS.NO_TASKS' | translate }}</p>
        </div>
        <div class="table-responsive" *ngIf="filteredTasks().length" style="overflow-x: auto;">
          <table class="task-table" style="min-width: 800px;">
            <thead>
              <tr>
                <th>{{ 'TASKS.TASK_CODE' | translate }}</th>
                <th>{{ isAr() ? 'العنوان' : 'Title' }}</th>
                <th>{{ isAr() ? 'الأولوية' : 'Priority' }}</th>
                <th>{{ isAr() ? 'الحالة' : 'Status' }}</th>
                <th>{{ 'TASKS.ASSIGNED_TO' | translate }}</th>
                <th>{{ 'TASKS.DUE_DATE' | translate }}</th>
                <th>{{ 'TASKS.PROGRESS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let task of filteredTasks()" [routerLink]="['/tasks', task.id]" class="task-row-tr">
                <td><span class="code-badge">{{ task.taskCode }}</span></td>
                <td class="task-title-cell">{{ isAr() && task.titleAr ? task.titleAr : task.title }}</td>
                <td><span class="priority-chip" [class]="task.priority.toLowerCase()">{{ getPriorityLabel(task.priority) }}</span></td>
                <td><span class="status-chip" [class]="getStatusClass(task.status)">{{ getStatusLabel(task.status) }}</span></td>
                <td>{{ isAr() ? task.assignedTo?.fullNameAr : task.assignedTo?.fullName }}</td>
                <td [style.color]="isOverdue(task) ? '#dc2626' : 'inherit'">{{ task.dueDate | date:'dd/MM/yyyy' }}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div class="tf-progress" style="width:80px"><div class="tf-progress__fill" [style.width]="task.progressPercent + '%'"></div></div>
                    <span style="font-size:12px;font-weight:700">{{ task.progressPercent }}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .STATUS_COLUMNS { }

    .filters-bar {
      display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;
      .filter-search  { flex: 1; min-width: 200px; }
      .filter-select  { width: 160px; }
    }

    .view-toggle {
      display: flex; border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden;
      button {
        background: none; border: none; padding: 8px 12px;
        cursor: pointer; color: var(--text-secondary); display: flex; align-items: center;
        transition: all var(--transition);
        mat-icon { font-size: 20px; }
        &.active { background: var(--color-primary); color: white; }
        &:hover:not(.active) { background: var(--bg-main); }
      }
    }

    .column-empty {
      text-align: center; padding: 24px 12px; color: var(--text-muted);
      mat-icon { font-size: 32px; opacity: 0.3; }
      p { font-size: 12px; margin-top: 4px; }
    }

    .kanban-task-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 8px;
    }

    .task-code-badge {
      font-size: 10px; color: var(--text-muted); font-family: monospace;
    }

    .kanban-task-title {
      font-size: 13px; font-weight: 600; margin-bottom: 10px; line-height: 1.4;
    }

    .kanban-task-footer {
      display: flex; align-items: center; gap: 8px;
    }

    .mini-avatar {
      width: 24px; height: 24px; border-radius: 50%;
      background: var(--color-primary-light); color: white;
      font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    .due-info {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; color: var(--text-muted); margin-top: 6px;
    }

    .code-badge {
      background: var(--bg-main); padding: 2px 8px; border-radius: 4px;
      font-size: 11px; font-family: monospace; font-weight: 600;
    }

    .list-view { padding: 0; overflow: hidden; }

    .task-table {
      width: 100%; border-collapse: collapse;
      th {
        padding: 12px 16px; text-align: inherit; font-size: 12px;
        font-weight: 700; color: var(--text-muted); background: var(--bg-main);
        border-bottom: 1px solid var(--border-color);
      }
      td { padding: 14px 16px; border-bottom: 1px solid var(--border-color); font-size: 13px; }
    }

    .task-row-tr {
      cursor: pointer; transition: background var(--transition);
      &:hover { background: var(--bg-main); }
      &:last-child td { border-bottom: none; }
    }

    .task-title-cell { font-weight: 600; max-width: 250px; }

    .empty-state {
      text-align: center; padding: 60px; color: var(--text-muted);
      mat-icon { font-size: 56px; opacity: 0.2; }
      p { margin-top: 8px; }
    }

    .loading-center { display: flex; justify-content: center; padding: 60px; }
  `],
})
export class TasksListComponent implements OnInit {
  readonly STATUS_COLUMNS = STATUS_COLUMNS;

  tasks = signal<any[]>([]);
  filteredTasks = signal<any[]>([]);
  loading = signal(true);
  view = signal<'kanban' | 'list'>('kanban');
  searchTerm = '';
  filterStatus = '';
  filterPriority = '';
  totalTasks = computed(() => this.filteredTasks().length);

  isAr = () => this.langService.getCurrentLang() === 'ar';
  canCreate = () => this.authService.hasRoleLevel(3);

  constructor(
    private taskService: TaskService,
    private authService: AuthService,
    private langService: LangService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['status']) this.filterStatus = p['status'];
      this.loadTasks();
    });
  }

  loadTasks() {
    this.loading.set(true);
    this.taskService.getAll().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.tasks.set(res.data);
          this.applyFilters();
        }
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters() {
    let list = this.tasks();
    if (this.searchTerm) {
      const s = this.searchTerm.toLowerCase();
      list = list.filter(t => t.title?.toLowerCase().includes(s) || t.taskCode?.toLowerCase().includes(s));
    }
    if (this.filterStatus) list = list.filter(t => t.status === this.filterStatus);
    if (this.filterPriority) list = list.filter(t => t.priority === this.filterPriority);
    this.filteredTasks.set(list);
  }

  getTasksByStatus(status: string) {
    return this.filteredTasks().filter(t => t.status === status);
  }

  openNewTask() {
    const ref = this.dialog.open(TaskFormDialogComponent, {
      width: '600px', disableClose: true,
      panelClass: 'task-dialog',
    });
    ref.afterClosed().subscribe(result => { if (result) this.loadTasks(); });
  }

  exportCsv() {
    const filters: any = {};
    if (this.filterStatus)   filters.status   = this.filterStatus;
    if (this.filterPriority) filters.priority = this.filterPriority;
    this.taskService.exportTasksCsv(filters).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasks-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.snack.open(this.isAr() ? 'تم تصدير المهام بنجاح' : 'Tasks exported successfully', '✓', { duration: 2500 });
      },
      error: () => this.snack.open(this.isAr() ? 'حدث خطأ' : 'Export failed', 'X'),
    });
  }

  getInitial(name?: string): string { return name ? name.charAt(0).toUpperCase() : '?'; }
  isOverdue(task: any): boolean { return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED'; }

  getPriorityLabel(p: string): string {
    if (this.isAr()) return { LOW: 'منخفض', MEDIUM: 'متوسط', HIGH: 'عالٍ', URGENT: 'عاجل' }[p] || p;
    return p;
  }

  getStatusLabel(s: string): string {
    const col = STATUS_COLUMNS.find(c => c.key === s);
    return col ? (this.isAr() ? col.labelAr : col.label) : s;
  }

  getStatusClass(s: string): string {
    return { NEW: 'new', IN_PROGRESS: 'in-progress', UNDER_REVIEW: 'under-review', REVISION_REQUIRED: 'revision', COMPLETED: 'completed', CANCELLED: 'cancelled' }[s] || '';
  }
}
