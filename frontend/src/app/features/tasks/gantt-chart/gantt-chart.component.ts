import { Component, Input, OnChanges, SimpleChanges, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LangService } from '../../../core/services/lang.service';
import Gantt from 'frappe-gantt';

@Component({
  selector: 'app-gantt-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="gantt-wrapper tf-card premium-glass fade-in">
      <div class="gantt-header">
        <h3 class="gantt-title">📅 {{ isAr() ? 'المخطط الزمني للمشاريع' : 'Project Timeline' }}</h3>
        <div class="gantt-controls">
          <button (click)="changeViewMode('Quarter Day')" [class.active]="viewMode === 'Quarter Day'">{{ isAr() ? 'ربع يوم' : 'Quarter Day' }}</button>
          <button (click)="changeViewMode('Half Day')" [class.active]="viewMode === 'Half Day'">{{ isAr() ? 'نصف يوم' : 'Half Day' }}</button>
          <button (click)="changeViewMode('Day')" [class.active]="viewMode === 'Day'">{{ isAr() ? 'يوم' : 'Day' }}</button>
          <button (click)="changeViewMode('Week')" [class.active]="viewMode === 'Week'">{{ isAr() ? 'أسبوع' : 'Week' }}</button>
          <button (click)="changeViewMode('Month')" [class.active]="viewMode === 'Month'">{{ isAr() ? 'شهر' : 'Month' }}</button>
        </div>
      </div>
      <div class="gantt-container" #ganttContainer>
        <!-- frappe-gantt will be rendered here -->
        <svg #ganttSvg></svg>
      </div>
      <div *ngIf="!tasks || tasks.length === 0" class="empty-state">
        <p>{{ isAr() ? 'لا توجد مهام صالحة للعرض (يجب أن تحتوي المهمة على تاريخ بداية وتاريخ نهاية).' : 'No valid tasks to display (tasks must have start and end dates).' }}</p>
      </div>
    </div>
  `,
  styles: [`
    .gantt-wrapper { padding: 20px; overflow: hidden; display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
    .gantt-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; border-bottom: 1px solid rgba(var(--border-rgb), 0.5); padding-bottom: 12px; }
    .gantt-title { font-size: 18px; font-weight: 700; color: var(--text-main); margin: 0; }
    .gantt-controls { display: flex; gap: 8px; background: rgba(var(--bg-main-rgb), 0.5); padding: 4px; border-radius: 8px; border: 1px solid var(--border-color); }
    .gantt-controls button { background: transparent; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--text-muted); transition: all 0.2s; }
    .gantt-controls button:hover { background: rgba(var(--primary-rgb), 0.1); color: var(--primary); }
    .gantt-controls button.active { background: var(--primary); color: white; box-shadow: 0 2px 8px rgba(var(--primary-rgb), 0.4); }
    
    .gantt-container { width: 100%; overflow-x: auto; overflow-y: hidden; background: #fff; border-radius: 8px; }
    
    /* Global frappe-gantt overrides for better dark mode compatibility if needed, but keeping it white background is usually safer for frappe-gantt */
    ::ng-deep .gantt .grid-header { fill: #f8fafc; }
    ::ng-deep .gantt .grid-row:nth-child(even) { fill: #f8fafc; }
    ::ng-deep .gantt .grid-row:nth-child(odd) { fill: #ffffff; }
    ::ng-deep .gantt .bar-wrapper { cursor: pointer; }
    ::ng-deep .gantt .bar-progress { fill: var(--primary); }
    ::ng-deep .gantt .bar-label { fill: #fff; font-weight: 600; font-size: 12px; }
    ::ng-deep .gantt .bar-wrapper:hover .bar-label { fill: #fff; }
    
    /* Status colors via custom_class */
    ::ng-deep .gantt .status-new .bar { fill: #64748b; }
    ::ng-deep .gantt .status-in_progress .bar { fill: #3b82f6; }
    ::ng-deep .gantt .status-under_review .bar { fill: #a855f7; }
    ::ng-deep .gantt .status-revision_required .bar { fill: #f97316; }
    ::ng-deep .gantt .status-completed .bar { fill: #22c55e; }

    ::ng-deep html[dir="rtl"] .gantt .bar-label { text-anchor: middle !important; }

    .empty-state { padding: 40px; text-align: center; color: var(--text-muted); font-weight: 500; }
  `]
})
export class GanttChartComponent implements OnChanges, AfterViewInit {
  @Input() tasks: any[] = [];
  @ViewChild('ganttSvg') ganttSvg!: ElementRef;
  
  gantt: any;
  viewMode: 'Quarter Day' | 'Half Day' | 'Day' | 'Week' | 'Month' | 'Year' = 'Day';
  isAr = () => this.langService.getCurrentLang() === 'ar';

  constructor(private langService: LangService, private router: Router) {}

  ngAfterViewInit() {
    this.renderGantt();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tasks'] && !changes['tasks'].firstChange) {
      this.renderGantt();
    }
  }

  changeViewMode(mode: 'Quarter Day' | 'Half Day' | 'Day' | 'Week' | 'Month' | 'Year') {
    this.viewMode = mode;
    if (this.gantt) {
      this.gantt.change_view_mode(mode);
    }
  }

  @HostListener('window:resize')
  onResize() {
    // Re-render chart on resize if needed
  }

  private renderGantt() {
    if (!this.ganttSvg) return;

    // Filter tasks that have both start and due dates
    const validTasks = this.tasks.filter(t => t.startDate && t.dueDate);
    
    if (validTasks.length === 0) {
      if (this.gantt) {
        this.ganttSvg.nativeElement.innerHTML = '';
        this.gantt = null;
      }
      return;
    }

    const formattedTasks = validTasks.map(t => {
      // Calculate progress if not provided
      let progress = t.progressPercent || 0;
      if (t.status === 'COMPLETED') progress = 100;
      else if (t.status === 'NEW') progress = 0;
      else if (t.status === 'IN_PROGRESS' && progress === 0) progress = 20;

      // Status class for styling
      const statusClass = 'status-' + t.status.toLowerCase();

      // Ensure start date is before end date
      let start = new Date(t.startDate);
      let end = new Date(t.dueDate);
      if (end < start) {
        // Swap if end is before start
        end = new Date(t.startDate);
        start = new Date(t.dueDate);
      }

      return {
        id: t.id.toString(),
        name: this.isAr() && t.titleAr ? t.titleAr : t.title,
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        progress: progress,
        dependencies: t.dependsOnId ? t.dependsOnId.toString() : '',
        custom_class: statusClass
      };
    });

    if (this.gantt) {
      this.gantt.refresh(formattedTasks);
    } else {
      this.gantt = new Gantt(this.ganttSvg.nativeElement, formattedTasks, {
        on_click: (task: any) => {
          this.router.navigate(['/tasks', task.id]);
        },
        on_date_change: (task: any, start: Date, end: Date) => {
          // Ideally, we'd fire an event to update the task in the backend
          // but for now we'll just log it or dispatch a basic event.
          console.log(`Task ${task.id} dates changed to ${start} - ${end}`);
        },
        on_progress_change: (task: any, progress: number) => {
          console.log(`Task ${task.id} progress changed to ${progress}%`);
        },
        view_mode: this.viewMode,
        language: this.isAr() ? 'ar' : 'en',
        bar_height: 30,
        padding: 18
      });
    }
  }
}
