import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { LangService } from '../../core/services/lang.service';

@Component({
  selector: 'app-global-search-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    <div class="search-dialog" [dir]="isAr() ? 'rtl' : 'ltr'">
      <div class="search-header">
        <mat-icon class="search-icon">search</mat-icon>
        <input #searchInput type="text" [(ngModel)]="query" (ngModelChange)="onSearchQueryChange($event)"
               [placeholder]="isAr() ? 'ابحث عن مهام، مستخلصات، موظفين...' : 'Search tasks, extracts, users...'"
               autocomplete="off" (keydown.enter)="executeSearch()">
        <button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="search-body">
        <div class="loading-state" *ngIf="loading">
          <mat-spinner diameter="30"></mat-spinner>
        </div>

        <div class="empty-state" *ngIf="!loading && query.length >= 2 && isEmpty()">
          <mat-icon>search_off</mat-icon>
          <p>{{ isAr() ? 'لا توجد نتائج' : 'No results found' }}</p>
        </div>

        <div class="initial-state" *ngIf="!loading && query.length < 2">
          <mat-icon>keyboard</mat-icon>
          <p>{{ isAr() ? 'اكتب للبحث...' : 'Type to start searching...' }}</p>
        </div>

        <div class="results-container" *ngIf="!loading && !isEmpty() && query.length >= 2">
          
          <!-- Tasks -->
          <div class="result-group" *ngIf="results.tasks?.length">
            <div class="group-title">{{ isAr() ? 'المهام' : 'Tasks' }}</div>
            <div class="result-item" *ngFor="let t of results.tasks" (click)="navigate('/tasks', t.id)">
              <mat-icon>assignment</mat-icon>
              <div class="item-info">
                <span class="item-title">{{ isAr() && t.titleAr ? t.titleAr : t.title }}</span>
                <span class="item-meta">{{ t.taskCode }} · {{ getStatus(t.status) }}</span>
              </div>
            </div>
          </div>

          <!-- Extracts -->
          <div class="result-group" *ngIf="results.extracts?.length">
            <div class="group-title">{{ isAr() ? 'المستخلصات' : 'Extracts' }}</div>
            <div class="result-item" *ngFor="let e of results.extracts" (click)="navigate('/extracts', null)">
              <mat-icon>receipt_long</mat-icon>
              <div class="item-info">
                <span class="item-title">{{ isAr() ? 'مستخلص رقم' : 'Extract #' }} {{ e.extractNumber }}</span>
                <span class="item-meta">{{ e.contractor?.name }} · {{ e.project?.name }}</span>
              </div>
            </div>
          </div>

          <!-- Users -->
          <div class="result-group" *ngIf="results.users?.length">
            <div class="group-title">{{ isAr() ? 'الموظفين' : 'Employees' }}</div>
            <div class="result-item" *ngFor="let u of results.users" (click)="navigate('/users', null)">
              <mat-icon>person</mat-icon>
              <div class="item-info">
                <span class="item-title">{{ isAr() ? u.fullNameAr : u.fullName }}</span>
                <span class="item-meta">{{ isAr() ? u.role?.nameAr : u.role?.name }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .search-dialog {
      display: flex; flex-direction: column; background: var(--bg-card);
      border-radius: 12px; overflow: hidden; max-height: 85vh; width: 600px;
    }
    .search-header {
      display: flex; align-items: center; padding: 12px 20px; border-bottom: 1px solid var(--border-color);
      background: var(--bg-main);
      .search-icon { color: var(--text-muted); margin: 0 10px; }
      input {
        flex: 1; border: none; background: transparent; font-size: 18px; outline: none; color: var(--text-main);
        font-family: inherit; padding: 8px 0;
      }
      .close-btn {
        background: rgba(100,116,139,0.1); border: none; border-radius: 6px; cursor: pointer; padding: 4px;
        color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
        &:hover { background: rgba(100,116,139,0.2); }
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }
    .search-body { padding: 10px 0; overflow-y: auto; flex: 1; min-height: 300px; }
    .loading-state, .empty-state, .initial-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 40px; color: var(--text-muted); height: 100%; min-height: 200px;
      mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.3; margin-bottom: 16px; }
      p { font-size: 16px; margin: 0; }
    }
    .result-group { margin-bottom: 16px; }
    .group-title { padding: 4px 20px; font-size: 12px; font-weight: 700; color: var(--color-primary-light); text-transform: uppercase; letter-spacing: 0.5px; }
    .result-item {
      display: flex; align-items: center; padding: 12px 20px; cursor: pointer; transition: background 0.2s;
      border-left: 3px solid transparent;
      &:hover { background: var(--bg-main); border-left-color: var(--color-primary); }
      mat-icon { color: var(--text-secondary); margin-inline-end: 16px; }
      .item-info { display: flex; flex-direction: column; }
      .item-title { font-size: 14px; font-weight: 600; color: var(--text-main); }
      .item-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    }
  `]
})
export class GlobalSearchDialogComponent implements OnInit {
  @ViewChild('searchInput') searchInput!: ElementRef;
  query = '';
  loading = false;
  results: any = { tasks: [], extracts: [], users: [], notifications: [] };
  
  private searchSubject = new Subject<string>();

  constructor(
    private dialogRef: MatDialogRef<GlobalSearchDialogComponent>,
    private http: HttpClient,
    private router: Router,
    private langService: LangService
  ) {}

  isAr = () => this.langService.getCurrentLang() === 'ar';

  ngOnInit() {
    this.searchSubject.pipe(debounceTime(400), distinctUntilChanged()).subscribe(q => {
      if (q.length >= 2) this.executeSearch();
      else { this.results = { tasks: [], extracts: [], users: [], notifications: [] }; this.loading = false; }
    });
    setTimeout(() => this.searchInput?.nativeElement?.focus(), 100);
  }

  onSearchQueryChange(val: string) {
    if (val.length >= 2) this.loading = true;
    this.searchSubject.next(val);
  }

  executeSearch() {
    if (this.query.length < 2) return;
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/search?q=${encodeURIComponent(this.query)}`).subscribe({
      next: (res) => {
        if (res.success) this.results = res.data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  isEmpty() {
    return !this.results.tasks?.length && !this.results.extracts?.length && !this.results.users?.length && !this.results.notifications?.length;
  }

  close() { this.dialogRef.close(); }

  navigate(path: string, id: any) {
    this.close();
    if (id) this.router.navigate([path, id]);
    else this.router.navigate([path]);
  }

  getStatus(s: string) {
    const mapAr: any = { NEW: 'جديدة', IN_PROGRESS: 'قيد التنفيذ', COMPLETED: 'مكتملة', UNDER_REVIEW: 'مراجعة', REVISION_REQUIRED: 'تعديل', CANCELLED: 'ملغاة' };
    const mapEn: any = { NEW: 'New', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', UNDER_REVIEW: 'Under Review', REVISION_REQUIRED: 'Revision Required', CANCELLED: 'Cancelled' };
    return this.isAr() ? (mapAr[s] || s) : (mapEn[s] || s);
  }
}
