import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { TaskService } from '../../core/services/task.service';
import { LangService } from '../../core/services/lang.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTooltipModule, TranslateModule],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div class="page-title">
          <h1>{{ isAr() ? '📅 تقويم المهام' : '📅 Task Calendar' }}</h1>
          <p>{{ isAr() ? 'عرض المهام على التقويم' : 'View tasks on calendar' }}</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button mat-stroked-button (click)="prevMonth()"><mat-icon>chevron_left</mat-icon></button>
          <span class="month-label">{{ getMonthLabel() }}</span>
          <button mat-stroked-button (click)="nextMonth()"><mat-icon>chevron_right</mat-icon></button>
          <button mat-stroked-button (click)="goToday()">{{ isAr() ? 'اليوم' : 'Today' }}</button>
        </div>
      </div>

      <div *ngIf="loading()" class="loading-center"><mat-spinner diameter="40"></mat-spinner></div>

      <div *ngIf="!loading()" class="calendar-wrapper">
        <!-- Day headers -->
        <div class="cal-grid">
          <div class="cal-day-header" *ngFor="let d of dayHeaders()">{{ d }}</div>

          <!-- Empty cells before month start -->
          <div class="cal-cell cal-cell--empty" *ngFor="let _ of emptyStart()"></div>

          <!-- Day cells -->
          <div class="cal-cell" *ngFor="let day of daysInMonth()"
               [class.today]="isToday(day)"
               [class.has-tasks]="getTasksForDay(day).length > 0">
            <div class="cal-date">{{ day }}</div>
            <div class="cal-tasks">
              <div class="cal-task-chip"
                   *ngFor="let t of getTasksForDay(day).slice(0, 3)"
                   [style.background]="getPriorityColor(t.priority)"
                   [routerLink]="['/tasks', t.id]"
                   [matTooltip]="isAr() && t.titleAr ? t.titleAr : t.title">
                {{ (isAr() && t.titleAr ? t.titleAr : t.title) | slice:0:20 }}{{ (isAr() && t.titleAr ? t.titleAr : t.title).length > 20 ? '…' : '' }}
              </div>
              <div class="cal-more" *ngIf="getTasksForDay(day).length > 3">
                +{{ getTasksForDay(day).length - 3 }} {{ isAr() ? 'أكثر' : 'more' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="legend">
          <div class="legend-item" *ngFor="let p of priorities">
            <span class="legend-dot" [style.background]="p.color"></span>
            <span>{{ isAr() ? p.labelAr : p.label }}</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot today-dot"></span>
            <span>{{ isAr() ? 'اليوم' : 'Today' }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .month-label { font-size: 18px; font-weight: 800; min-width: 160px; text-align: center; }

    .calendar-wrapper { background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); overflow: hidden; }

    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
    }

    .cal-day-header {
      padding: 10px; text-align: center; font-size: 12px; font-weight: 700;
      color: var(--text-muted); background: var(--bg-main);
      border-bottom: 1px solid var(--border-color);
    }

    .cal-cell {
      min-height: 110px; padding: 8px; border-right: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color); vertical-align: top;
      transition: background var(--transition);
      &:hover { background: var(--bg-main); }
      &.today { background: rgba(46,134,171,0.07); }
      &.today .cal-date { background: var(--color-primary-light); color: white; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-weight: 800; }
      &.cal-cell--empty { background: var(--bg-main); opacity: 0.4; }
      &.has-tasks { border-top: 2px solid var(--color-primary-light); }
    }

    .cal-date { font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary); }

    .cal-tasks { display: flex; flex-direction: column; gap: 2px; }

    .cal-task-chip {
      font-size: 10px; font-weight: 600; color: white; padding: 2px 6px;
      border-radius: 4px; cursor: pointer; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; opacity: 0.9; transition: opacity var(--transition);
      &:hover { opacity: 1; }
    }

    .cal-more { font-size: 10px; color: var(--text-muted); font-weight: 600; padding: 2px 4px; }

    .legend {
      display: flex; align-items: center; gap: 20px; padding: 12px 16px;
      border-top: 1px solid var(--border-color); background: var(--bg-main);
      flex-wrap: wrap;
    }
    .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
    .legend-dot { width: 12px; height: 12px; border-radius: 3px; }
    .today-dot { background: var(--color-primary-light); border-radius: 50%; }

    .loading-center { display: flex; justify-content: center; padding: 60px; }

    @media (max-width: 768px) {
      .cal-cell { min-height: 70px; padding: 4px; }
      .cal-task-chip { display: none; }
      .cal-more { font-size: 9px; }
    }
  `]
})
export class CalendarComponent implements OnInit {
  tasks = signal<any[]>([]);
  loading = signal(true);
  currentDate = signal(new Date());

  isAr = () => this.langService.getCurrentLang() === 'ar';

  priorities = [
    { label: 'Urgent', labelAr: 'عاجل', color: '#dc2626' },
    { label: 'High',   labelAr: 'عالٍ', color: '#ea580c' },
    { label: 'Medium', labelAr: 'متوسط', color: '#2563eb' },
    { label: 'Low',    labelAr: 'منخفض', color: '#16a34a' },
  ];

  constructor(private taskService: TaskService, private langService: LangService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const d = this.currentDate();
    this.taskService.getCalendar(d.getFullYear(), d.getMonth() + 1).subscribe({
      next: r => { this.loading.set(false); if (r.success) this.tasks.set(r.data); },
      error: () => this.loading.set(false),
    });
  }

  prevMonth() { const d = this.currentDate(); this.currentDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1)); this.load(); }
  nextMonth() { const d = this.currentDate(); this.currentDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1)); this.load(); }
  goToday()   { this.currentDate.set(new Date()); this.load(); }

  getMonthLabel() {
    const d = this.currentDate();
    return d.toLocaleDateString(this.isAr() ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
  }

  dayHeaders() {
    return this.isAr()
      ? ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت']
      : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  }

  daysInMonth(): number[] {
    const d = this.currentDate();
    const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  emptyStart(): number[] {
    const d = this.currentDate();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    return Array.from({ length: firstDay });
  }

  isToday(day: number): boolean {
    const t = new Date(); const d = this.currentDate();
    return t.getDate() === day && t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear();
  }

  getTasksForDay(day: number): any[] {
    const d = this.currentDate();
    return this.tasks().filter(t => {
      const due = t.dueDate ? new Date(t.dueDate) : null;
      if (!due) return false;
      return due.getDate() === day && due.getMonth() === d.getMonth() && due.getFullYear() === d.getFullYear();
    });
  }

  getPriorityColor(p: string): string {
    return { URGENT: '#dc2626', HIGH: '#ea580c', MEDIUM: '#2563eb', LOW: '#16a34a' }[p] || '#888';
  }
}
