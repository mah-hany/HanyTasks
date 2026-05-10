import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ExtractService } from '../../core/services/extract.service';
import { AuthService } from '../../core/services/auth.service';
import { LangService } from '../../core/services/lang.service';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
<div class="page-container fade-in">
  <div class="page-header">
    <div class="page-title">
      <h1>🏛️ {{ isAr() ? 'المشاريع' : 'Projects' }}</h1>
      <p>{{ isAr() ? 'إدارة قائمة المشاريع المسجلة في النظام' : 'Manage registered projects' }}</p>
    </div>
    <button mat-raised-button color="primary" (click)="openForm(null)" *ngIf="canWrite()">
      <mat-icon>add</mat-icon> {{ isAr() ? 'مشروع جديد' : 'New Project' }}
    </button>
  </div>

  <!-- Search bar -->
  <div class="search-wrap tf-card">
    <mat-icon class="search-icon">search</mat-icon>
    <input class="search-input" [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()"
      [placeholder]="isAr() ? 'ابحث بالاسم أو الكود أو جزء منهم...' : 'Search by name or code...'" />
    <button mat-icon-button *ngIf="searchTerm" (click)="searchTerm=''; load()">
      <mat-icon>close</mat-icon>
    </button>
    <span class="result-count">{{ filtered().length }} {{ isAr() ? 'نتيجة' : 'results' }}</span>
  </div>

  <!-- Loading -->
  <div class="loading-center" *ngIf="loading()">
    <mat-spinner diameter="48"></mat-spinner>
  </div>

  <!-- Grid -->
  <div class="cards-grid" *ngIf="!loading()">
    <div class="entity-card tf-card" *ngFor="let p of filtered()">
      <div class="card-header">
        <div class="avatar proj-avatar">
          <mat-icon>domain</mat-icon>
        </div>
        <div class="card-info">
          <div class="card-name">{{ p.name }}</div>
          <div class="card-sub" *ngIf="p.nameAr">{{ p.nameAr }}</div>
        </div>
        <div class="card-badge">
          <mat-icon>receipt_long</mat-icon> {{ p._count?.extracts ?? 0 }}
        </div>
      </div>
      <div class="card-body">
        <div class="code-row" *ngIf="p.code">
          <mat-icon>qr_code</mat-icon>
          <span class="code-badge">{{ p.code }}</span>
        </div>
        <div class="code-row no-code" *ngIf="!p.code">
          <mat-icon>info</mat-icon>
          <span class="text-muted">{{ isAr() ? 'لا يوجد كود للمشروع' : 'No project code' }}</span>
        </div>
      </div>
      <div class="card-footer">
        <span class="status-chip" [class.active]="p.isActive" [class.inactive]="!p.isActive">
          {{ p.isActive ? (isAr() ? 'نشط' : 'Active') : (isAr() ? 'غير نشط' : 'Inactive') }}
        </span>
        <div class="card-actions" *ngIf="canEditDelete()">
          <button mat-icon-button color="primary" (click)="openForm(p)" [matTooltip]="isAr() ? 'تعديل' : 'Edit'">
            <mat-icon>edit</mat-icon>
          </button>
          <button mat-icon-button color="warn" (click)="deleteItem(p.id, p.name)" [matTooltip]="isAr() ? 'حذف' : 'Delete'">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div class="empty-state" *ngIf="filtered().length === 0">
      <mat-icon>domain_disabled</mat-icon>
      <h3>{{ isAr() ? 'لا توجد مشاريع' : 'No Projects' }}</h3>
      <p>{{ searchTerm ? (isAr() ? 'لا توجد نتائج للبحث' : 'No search results') : (isAr() ? 'أضف أول مشروع للنظام' : 'Add the first project') }}</p>
      <button mat-raised-button color="primary" (click)="openForm(null)" *ngIf="canWrite() && !searchTerm">
        <mat-icon>add</mat-icon> {{ isAr() ? 'إضافة مشروع' : 'Add Project' }}
      </button>
    </div>
  </div>
</div>

<!-- Inline Form Dialog -->
<div class="form-overlay" *ngIf="showForm()">
  <div class="form-backdrop" (click)="closeForm()"></div>
  <div class="form-drawer tf-card">
    <div class="form-header">
      <h3>{{ editId ? (isAr() ? 'تعديل مشروع' : 'Edit Project') : (isAr() ? 'مشروع جديد' : 'New Project') }}</h3>
      <button mat-icon-button (click)="closeForm()"><mat-icon>close</mat-icon></button>
    </div>
    <div class="form-body">
      <mat-form-field appearance="outline" class="w100">
        <mat-label>{{ isAr() ? 'اسم المشروع *' : 'Project Name *' }}</mat-label>
        <input matInput [(ngModel)]="form.name" [placeholder]="isAr() ? 'اسم المشروع بالإنجليزية' : 'Project name'">
      </mat-form-field>
      <mat-form-field appearance="outline" class="w100">
        <mat-label>{{ isAr() ? 'الاسم بالعربي' : 'Arabic Name' }}</mat-label>
        <input matInput [(ngModel)]="form.nameAr" placeholder="اسم المشروع بالعربي">
      </mat-form-field>
      <mat-form-field appearance="outline" class="w100">
        <mat-label>{{ isAr() ? 'كود المشروع' : 'Project Code' }}</mat-label>
        <input matInput [(ngModel)]="form.code" [placeholder]="isAr() ? 'مثال: PRJ-001' : 'e.g. PRJ-001'">
        <mat-icon matPrefix>qr_code</mat-icon>
        <mat-hint>{{ isAr() ? 'يُستخدم في البحث السريع' : 'Used for quick search' }}</mat-hint>
      </mat-form-field>
    </div>
    <div class="form-footer">
      <button mat-button (click)="closeForm()">{{ isAr() ? 'إلغاء' : 'Cancel' }}</button>
      <button mat-raised-button color="primary" (click)="save()"
        [disabled]="!form.name?.trim() || saving()">
        <mat-spinner *ngIf="saving()" diameter="16"></mat-spinner>
        <mat-icon *ngIf="!saving()">save</mat-icon>
        {{ isAr() ? 'حفظ' : 'Save' }}
      </button>
    </div>
  </div>
</div>
  `,
  styles: [`
    .search-wrap {
      display:flex; align-items:center; gap:10px; padding:10px 16px; margin-bottom:20px;
      .search-icon { color:var(--text-muted); }
      .search-input { flex:1; border:none; outline:none; background:transparent; font-size:14px; color:var(--text-primary); }
      .result-count { font-size:12px; color:var(--text-muted); white-space:nowrap; }
    }
    .cards-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
    .entity-card { display:flex; flex-direction:column; transition:transform .2s,box-shadow .2s; &:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,.1);} }
    .card-header { display:flex; align-items:center; gap:12px; padding:16px 16px 0; }
    .avatar {
      width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,#2563eb,#1d4ed8);
      color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0;
      mat-icon { font-size:26px; }
    }
    .card-info { flex:1; min-width:0; }
    .card-name { font-size:15px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .card-sub  { font-size:12px; color:var(--text-muted); margin-top:2px; }
    .card-badge { display:flex; align-items:center; gap:4px; font-size:12px; font-weight:700; color:#2563eb; mat-icon{font-size:16px;} }
    .card-body { padding:12px 16px; flex:1; }
    .code-row { display:flex; align-items:center; gap:8px; font-size:13px; mat-icon{font-size:16px;color:var(--text-muted);} }
    .code-badge { font-family:monospace; background:var(--bg-main); padding:3px 10px; border-radius:6px; font-size:13px; font-weight:700; letter-spacing:.5px; }
    .text-muted { color:var(--text-muted); font-style:italic; font-size:13px; }
    .no-code { color:var(--text-muted); }
    .card-footer { display:flex; align-items:center; justify-content:space-between; padding:10px 16px 14px; border-top:1px solid var(--border-color); }
    .status-chip { font-size:11px; font-weight:700; padding:2px 10px; border-radius:20px;
      &.active   { background:#f0fdf4; color:#16a34a; }
      &.inactive { background:#fef2f2; color:#dc2626; }
    }
    .empty-state { grid-column:1/-1; text-align:center; padding:80px 24px; color:var(--text-muted);
      mat-icon{font-size:72px;opacity:.15;display:block;margin:0 auto;}
      h3{margin:20px 0 8px;font-size:20px;font-weight:700;}
      p{font-size:14px;margin-bottom:24px;}
    }
    .loading-center{display:flex;justify-content:center;padding:80px;}
    .form-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
    .form-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(3px);}
    .form-drawer{position:relative;z-index:201;width:480px;max-width:calc(100vw - 40px);height:min(90vh,480px);display:flex;flex-direction:column;overflow:hidden;}
    .form-header{display:flex;align-items:center;justify-content:space-between;padding:18px 24px 14px;flex-shrink:0;border-bottom:1px solid var(--border-color);h3{font-size:16px;font-weight:700;margin:0;}}
    .form-body{padding:16px 24px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;flex:1;min-height:0;}
    .form-footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 24px 16px;flex-shrink:0;border-top:1px solid var(--border-color);}
    .w100{width:100%;}
    button[mat-raised-button]{display:flex;align-items:center;gap:6px;}
  `]
})
export class ProjectsPageComponent implements OnInit {
  all       = signal<any[]>([]);
  filtered  = signal<any[]>([]);
  loading   = signal(true);
  saving    = signal(false);
  showForm  = signal(false);
  searchTerm = '';
  editId: number | null = null;
  form: any = {};

  isAr     = () => this.lang.getCurrentLang() === 'ar';
  canWrite = () => (this.auth.currentUser()?.role?.level ?? 99) <= 4;
  canEditDelete = () => (this.auth.currentUser()?.role?.level ?? 99) <= 2;

  constructor(
    private svc: ExtractService,
    private auth: AuthService,
    private lang: LangService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getProjects().subscribe({
      next: r => {
        this.loading.set(false);
        if (r.success) { this.all.set(r.data); this.applyFilter(); }
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilter() {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) { this.filtered.set(this.all()); return; }
    this.filtered.set(this.all().filter(p =>
      p.name?.toLowerCase().includes(term) ||
      p.nameAr?.toLowerCase().includes(term) ||
      p.code?.toLowerCase().includes(term)
    ));
  }

  openForm(item: any | null) {
    this.editId = item?.id ?? null;
    this.form   = item ? { name: item.name, nameAr: item.nameAr, code: item.code } : {};
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); this.editId = null; this.form = {}; }

  save() {
    if (!this.form.name?.trim()) return;
    this.saving.set(true);
    const req$ = this.editId
      ? this.svc.updateProject(this.editId, this.form)
      : this.svc.createProject(this.form);
    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.load();
        this.snack.open(this.isAr() ? 'تم الحفظ بنجاح ✓' : 'Saved successfully', '✓', { duration: 2500 });
      },
      error: e => { this.saving.set(false); this.snack.open(e.error?.message || 'Error', 'X'); },
    });
  }

  deleteItem(id: number, name: string) {
    if (!confirm(this.isAr() ? `هل أنت متأكد من تعطيل/حذف المشروع: ${name}؟` : `Are you sure you want to delete ${name}?`)) return;
    this.svc.deleteProject(id).subscribe({
      next: () => { this.load(); this.snack.open(this.isAr() ? 'تم الحذف' : 'Deleted', '✓', { duration: 2500 }); },
      error: e => this.snack.open(e.error?.message || 'Error', 'X'),
    });
  }
}
