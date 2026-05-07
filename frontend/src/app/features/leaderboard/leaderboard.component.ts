import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LangService } from '../../core/services/lang.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatSelectModule, MatTabsModule, MatProgressBarModule, MatTooltipModule],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div class="page-title">
          <h1>🏆 {{ isAr() ? 'لوحة المتصدرين' : 'Leaderboard' }}</h1>
          <p>{{ isAr() ? 'أفضل الموظفين أداءً' : 'Top performing employees' }}</p>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <select class="period-select" [(ngModel)]="period" (ngModelChange)="load()">
            <option value="week">{{ isAr() ? 'هذا الأسبوع' : 'This Week' }}</option>
            <option value="month">{{ isAr() ? 'هذا الشهر' : 'This Month' }}</option>
            <option value="year">{{ isAr() ? 'هذا العام' : 'This Year' }}</option>
          </select>
        </div>
      </div>

      <div class="lb-layout">
        <!-- My Points Card -->
        <div class="my-points-card tf-card" *ngIf="myData()">
          <div class="mp-header">
            <div class="mp-icon">🎯</div>
            <div>
              <div class="mp-title">{{ isAr() ? 'نقاطي' : 'My Points' }}</div>
              <div class="mp-level">{{ isAr() ? myData()?.level?.nameAr : myData()?.level?.name }}</div>
            </div>
          </div>
          <div class="mp-stats">
            <div class="mp-stat">
              <div class="mp-val">{{ myData()?.totalPoints }}</div>
              <div class="mp-lab">{{ isAr() ? 'إجمالي النقاط' : 'Total Points' }}</div>
            </div>
            <div class="mp-stat">
              <div class="mp-val">{{ myData()?.monthPoints }}</div>
              <div class="mp-lab">{{ isAr() ? 'هذا الشهر' : 'This Month' }}</div>
            </div>
          </div>
          <!-- Level Progress -->
          <div class="level-progress" *ngIf="myData()?.level">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px">
              <span>{{ isAr() ? 'المستوى' : 'Level' }} {{ myData()?.level?.level }}</span>
              <span>{{ myData()?.totalPoints }}/{{ myData()?.level?.nextLevelAt }}</span>
            </div>
            <mat-progress-bar mode="determinate"
              [value]="getLevelProgress()"
              color="accent">
            </mat-progress-bar>
          </div>
          <!-- Badges -->
          <div class="badges" *ngIf="myData()?.badges?.length">
            <div class="badge-chip" *ngFor="let b of myData()?.badges">{{ b }}</div>
          </div>
        </div>

        <!-- Leaderboard Table -->
        <div class="lb-main tf-card">
          <div *ngIf="loading()" class="loading-center"><mat-spinner diameter="40"></mat-spinner></div>

          <div class="lb-list" *ngIf="!loading()">
            <!-- Top 3 Podium -->
            <div class="podium" *ngIf="leaderboard().length >= 3">
              <div class="podium-item second">
                <div class="podium-avatar">{{ getInitial(leaderboard()[1]) }}</div>
                <div class="podium-name">{{ getName(leaderboard()[1]) }}</div>
                <div class="podium-points">{{ leaderboard()[1].totalPoints }} pts</div>
                <div class="podium-rank">🥈</div>
              </div>
              <div class="podium-item first">
                <div class="podium-avatar gold">{{ getInitial(leaderboard()[0]) }}</div>
                <div class="podium-name">{{ getName(leaderboard()[0]) }}</div>
                <div class="podium-points">{{ leaderboard()[0].totalPoints }} pts</div>
                <div class="podium-rank">🥇</div>
              </div>
              <div class="podium-item third">
                <div class="podium-avatar">{{ getInitial(leaderboard()[2]) }}</div>
                <div class="podium-name">{{ getName(leaderboard()[2]) }}</div>
                <div class="podium-points">{{ leaderboard()[2].totalPoints }} pts</div>
                <div class="podium-rank">🥉</div>
              </div>
            </div>

            <!-- Full List -->
            <div class="lb-row" *ngFor="let item of leaderboard()"
                 [class.is-me]="item.user?.id === myUserId()">
              <div class="rank-badge" [class]="'rank-' + Math.min(item.rank, 4)">{{ item.rank }}</div>
              <div class="lb-avatar">{{ getInitial(item) }}</div>
              <div class="lb-info">
                <div class="lb-name">{{ getName(item) }}</div>
                <div class="lb-sub">{{ isAr() ? item.user?.role?.nameAr : item.user?.role?.name }}</div>
              </div>
              <div class="lb-metrics">
                <div class="metric">
                  <span class="metric-val">{{ item.completedTasks }}</span>
                  <span class="metric-lab">{{ isAr() ? 'مكتملة' : 'Done' }}</span>
                </div>
                <div class="metric">
                  <span class="metric-val">{{ item.completionRate }}%</span>
                  <span class="metric-lab">{{ isAr() ? 'نسبة الإنجاز' : 'Rate' }}</span>
                </div>
                <div class="metric points">
                  <span class="metric-val">{{ item.totalPoints }}</span>
                  <span class="metric-lab">pts</span>
                </div>
              </div>
            </div>

            <div class="empty-state" *ngIf="!leaderboard().length">
              <mat-icon>emoji_events</mat-icon>
              <p>{{ isAr() ? 'لا توجد بيانات بعد' : 'No data yet' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .lb-layout { display: grid; grid-template-columns: 280px 1fr; gap: 20px; @media(max-width:900px) { grid-template-columns: 1fr; } }

    .period-select { border: 1px solid var(--border-color); border-radius: 8px; padding: 8px 12px; background: var(--bg-card); color: var(--text-primary); font-size: 14px; outline: none; cursor: pointer; }

    .my-points-card { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .mp-header { display: flex; align-items: center; gap: 12px; }
    .mp-icon { font-size: 32px; }
    .mp-title { font-size: 16px; font-weight: 700; }
    .mp-level { font-size: 12px; color: var(--color-primary-light); font-weight: 600; }
    .mp-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .mp-stat { text-align: center; background: var(--bg-main); border-radius: 8px; padding: 12px; }
    .mp-val { font-size: 24px; font-weight: 800; color: var(--color-primary-light); }
    .mp-lab { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; }
    .badge-chip { background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 20px; padding: 4px 10px; font-size: 11px; }

    .lb-main { padding: 20px; }
    .loading-center { display: flex; justify-content: center; padding: 60px; }

    .podium { display: flex; justify-content: center; align-items: flex-end; gap: 16px; margin-bottom: 32px; padding: 24px 0; }
    .podium-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .podium-item.first { order: 2; }
    .podium-item.second { order: 1; }
    .podium-item.third { order: 3; }
    .podium-avatar { width: 52px; height: 52px; border-radius: 50%; background: var(--color-primary-light); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; &.gold { width: 64px; height: 64px; background: linear-gradient(135deg, #f59e0b, #d97706); font-size: 26px; box-shadow: 0 0 20px rgba(245,158,11,0.4); } }
    .podium-rank { font-size: 24px; }
    .podium-name { font-size: 12px; font-weight: 600; text-align: center; max-width: 80px; }
    .podium-points { font-size: 11px; color: var(--color-primary-light); font-weight: 700; }

    .lb-row { display: flex; align-items: center; gap: 12px; padding: 12px 8px; border-radius: 10px; transition: background var(--transition); cursor: default; &:hover { background: var(--bg-main); } &.is-me { background: rgba(46,134,171,0.08); border: 1px solid var(--color-primary-light); } }
    .rank-badge { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex-shrink: 0; background: var(--bg-main); color: var(--text-muted); &.rank-1 { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; } &.rank-2 { background: linear-gradient(135deg, #94a3b8, #64748b); color: white; } &.rank-3 { background: linear-gradient(135deg, #d97706, #b45309); color: white; } }
    .lb-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
    .lb-info { flex: 1; }
    .lb-name { font-weight: 700; font-size: 14px; }
    .lb-sub { font-size: 11px; color: var(--text-muted); }
    .lb-metrics { display: flex; gap: 20px; }
    .metric { text-align: center; min-width: 48px; }
    .metric-val { font-size: 15px; font-weight: 800; display: block; }
    .metric-lab { font-size: 10px; color: var(--text-muted); }
    .metric.points .metric-val { color: var(--color-primary-light); }
    .empty-state { text-align: center; padding: 40px; color: var(--text-muted); mat-icon { font-size: 48px; opacity: 0.2; } }
  `]
})
export class LeaderboardComponent implements OnInit {
  leaderboard = signal<any[]>([]);
  myData = signal<any>(null);
  loading = signal(true);
  period = 'month';
  Math = Math;

  isAr = () => this.langService.getCurrentLang() === 'ar';
  myUserId = () => this.authService.currentUser()?.id;

  constructor(
    private http: HttpClient,
    private langService: LangService,
    private authService: AuthService,
  ) {}

  ngOnInit() { this.load(); this.loadMyPoints(); }

  load() {
    this.loading.set(true);
    this.http.get<any>(`${environment.apiUrl}/gamification/leaderboard?period=${this.period}`).subscribe({
      next: r => { this.loading.set(false); if (r.success) this.leaderboard.set(r.data); },
      error: () => this.loading.set(false),
    });
  }

  loadMyPoints() {
    this.http.get<any>(`${environment.apiUrl}/gamification/me`).subscribe({
      next: r => { if (r.success) this.myData.set(r.data); },
    });
  }

  getInitial(item: any): string {
    const name = this.isAr() ? item?.user?.fullNameAr : item?.user?.fullName;
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  getName(item: any): string {
    return this.isAr() ? (item?.user?.fullNameAr || item?.user?.fullName) : item?.user?.fullName;
  }

  getLevelProgress(): number {
    const d = this.myData();
    if (!d?.level) return 0;
    const prev = [0, 100, 300, 600, 1000, 2000][d.level.level - 1] || 0;
    const range = d.level.nextLevelAt - prev;
    const progress = d.totalPoints - prev;
    return Math.round((progress / range) * 100);
  }
}
