import { Component, OnInit, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LangService } from '../../../core/services/lang.service';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-time-tracker',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <div class="time-tracker-panel tf-card">
      <div class="tt-header">
        <mat-icon>schedule</mat-icon>
        <span>{{ isAr() ? 'تتبع الوقت' : 'Time Tracker' }}</span>
        <span class="total-time">{{ formatMinutes(totalMinutes()) }}</span>
      </div>

      <!-- Active Timer -->
      <div class="active-timer" *ngIf="isRunning()">
        <div class="timer-pulse"></div>
        <div class="timer-display">{{ displayTime() }}</div>
        <button mat-flat-button color="warn" (click)="stop()" [disabled]="loading()">
          <mat-icon>stop</mat-icon>
          {{ isAr() ? 'إيقاف' : 'Stop' }}
        </button>
      </div>

      <!-- Start Button -->
      <div class="start-area" *ngIf="!isRunning()">
        <input class="note-input" [(ngModel)]="note"
          [placeholder]="isAr() ? 'ملاحظة (اختياري)...' : 'Note (optional)...'" />
        <button mat-flat-button color="primary" (click)="start()" [disabled]="loading()">
          <mat-icon>play_arrow</mat-icon>
          {{ isAr() ? 'ابدأ التتبع' : 'Start Timer' }}
        </button>
      </div>

      <!-- Entries List -->
      <div class="entries" *ngIf="entries().length">
        <div class="entry-row" *ngFor="let e of entries()">
          <div class="entry-info">
            <span class="entry-user">{{ isAr() ? e.user?.fullNameAr : e.user?.fullName }}</span>
            <span class="entry-date">{{ e.startTime | date:'dd/MM HH:mm' }}</span>
          </div>
          <div class="entry-dur">
            <mat-icon style="font-size:14px">schedule</mat-icon>
            {{ formatMinutes(e.duration || 0) }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .time-tracker-panel { padding: 16px; }
    .tt-header { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; margin-bottom: 12px; mat-icon { color: var(--color-primary-light); } }
    .total-time { margin-inline-start: auto; background: var(--bg-main); border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 700; color: var(--color-primary-light); }

    .active-timer { display: flex; align-items: center; gap: 12px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; }
    .timer-pulse { width: 10px; height: 10px; border-radius: 50%; background: #22c55e; animation: pulse 1.5s infinite; flex-shrink: 0; }
    @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.4); } }
    .timer-display { font-size: 22px; font-weight: 800; font-family: monospace; flex: 1; color: #22c55e; }

    .start-area { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .note-input { border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 10px; font-size: 13px; background: var(--bg-main); color: var(--text-primary); outline: none; &:focus { border-color: var(--color-primary-light); } }

    .entries { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; }
    .entry-row { display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 6px; font-size: 12px; &:hover { background: var(--bg-main); } }
    .entry-info { display: flex; flex-direction: column; }
    .entry-user { font-weight: 600; }
    .entry-date { color: var(--text-muted); }
    .entry-dur { display: flex; align-items: center; gap: 4px; font-weight: 700; color: var(--color-primary-light); }
  `]
})
export class TimeTrackerComponent implements OnInit, OnDestroy {
  entries = signal<any[]>([]);
  loading = signal(false);
  isRunning = signal(false);
  startedAt = signal<Date | null>(null);
  displayTime = signal('00:00:00');
  note = '';
  totalMinutes = computed(() => this.entries().reduce((s, e) => s + (e.duration || 0), 0));

  private interval: any;
  taskId!: number;

  isAr = () => this.langService.getCurrentLang() === 'ar';

  constructor(
    private http: HttpClient,
    private langService: LangService,
    private authService: AuthService,
    private snack: MatSnackBar,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.taskId = +this.route.snapshot.params['id'];
    this.loadEntries();
    this.checkActiveTimer();
  }

  ngOnDestroy() { clearInterval(this.interval); }

  loadEntries() {
    this.http.get<any>(`${environment.apiUrl}/time/${this.taskId}`).subscribe({
      next: r => { if (r.success) this.entries.set(r.data); },
    });
  }

  checkActiveTimer() {
    this.http.get<any>(`${environment.apiUrl}/time/active/me`).subscribe({
      next: r => {
        if (r.success && r.data && r.data.taskId === this.taskId) {
          this.isRunning.set(true);
          this.startedAt.set(new Date(r.data.startTime));
          this.startClock();
        }
      },
    });
  }

  start() {
    this.loading.set(true);
    this.http.post<any>(`${environment.apiUrl}/time/${this.taskId}/start`, { note: this.note }).subscribe({
      next: r => {
        this.loading.set(false);
        if (r.success) {
          this.isRunning.set(true);
          this.startedAt.set(new Date(r.data.startTime));
          this.startClock();
          this.note = '';
          this.snack.open(this.isAr() ? 'بدأ التوقيت ✅' : 'Timer started ✅', '', { duration: 2000 });
        }
      },
      error: () => this.loading.set(false),
    });
  }

  stop() {
    this.loading.set(true);
    this.http.post<any>(`${environment.apiUrl}/time/${this.taskId}/stop`, {}).subscribe({
      next: r => {
        this.loading.set(false);
        if (r.success) {
          this.isRunning.set(false);
          this.startedAt.set(null);
          clearInterval(this.interval);
          this.displayTime.set('00:00:00');
          this.loadEntries();
          this.snack.open(
            this.isAr() ? `توقف ✅ ${this.formatMinutes(r.data.duration)} دقيقة` : `Stopped ✅ ${this.formatMinutes(r.data.duration)}`,
            '', { duration: 3000 }
          );
        }
      },
      error: () => this.loading.set(false),
    });
  }

  startClock() {
    clearInterval(this.interval);
    this.interval = setInterval(() => {
      const start = this.startedAt();
      if (!start) return;
      const diff = Math.floor((Date.now() - start.getTime()) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      this.displayTime.set(`${h}:${m}:${s}`);
    }, 1000);
  }

  formatMinutes(min: number): string {
    if (!min) return '0m';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}
