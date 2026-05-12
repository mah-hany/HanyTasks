import { Component, OnInit, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { ExtractService } from '../../core/services/extract.service';
import { AuthService } from '../../core/services/auth.service';
import { LangService } from '../../core/services/lang.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-contractors-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatMenuModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
<input #fileInput type="file" accept=".xlsx,.xls" style="display:none" (change)="onFileSelected($event)">

<div class="page-container fade-in">
  <div class="page-header">
    <div class="page-title">
      <h1>🏗️ {{ isAr() ? 'المقاولون' : 'Contractors' }}</h1>
      <p>{{ isAr() ? 'إدارة قائمة المقاولين' : 'Manage contractors' }} — <strong>{{ all().length }}</strong> {{ isAr() ? 'مقاول مسجل' : 'registered' }}</p>
    </div>
    <div class="header-actions">
      <!-- Import/Export menu -->
      <button mat-stroked-button [matMenuTriggerFor]="xlsMenu" *ngIf="canWrite()">
        <mat-icon>table_view</mat-icon> {{ isAr() ? 'Excel' : 'Excel' }}
        <mat-icon>arrow_drop_down</mat-icon>
      </button>
      <mat-menu #xlsMenu="matMenu">
        <button mat-menu-item (click)="downloadTemplate()" [disabled]="downloading()">
          <mat-icon color="primary">{{ downloading() ? 'hourglass_empty' : 'download' }}</mat-icon>
          <span>{{ isAr() ? (downloading() ? 'جاري التحميل...' : 'تحميل نموذج Excel الفارغ') : (downloading() ? 'Downloading...' : 'Download Template') }}</span>
        </button>
        <button mat-menu-item (click)="fileInput.click()" [disabled]="importing()">
          <mat-icon style="color:#16a34a">{{ importing() ? 'hourglass_empty' : 'upload_file' }}</mat-icon>
          <span>{{ isAr() ? (importing() ? 'جاري الاستيراد...' : 'استيراد من Excel') : (importing() ? 'Importing...' : 'Import from Excel') }}</span>
        </button>
        <button mat-menu-item (click)="exportExcel()" [disabled]="exporting()">
          <mat-icon style="color:#2563eb">{{ exporting() ? 'hourglass_empty' : 'file_download' }}</mat-icon>
          <span>{{ isAr() ? (exporting() ? 'جاري التصدير...' : 'تصدير الكل إلى Excel') : (exporting() ? 'Exporting...' : 'Export All to Excel') }}</span>
        </button>
      </mat-menu>
      <button mat-raised-button color="primary" (click)="openForm(null)" *ngIf="canWrite()">
        <mat-icon>add</mat-icon> {{ isAr() ? 'مقاول جديد' : 'New Contractor' }}
      </button>
    </div>
  </div>

  <!-- Template note -->
  <div class="template-note tf-card" *ngIf="showTemplateNote">
    <div class="note-header">
      <mat-icon>info</mat-icon>
      <strong>{{ isAr() ? 'تنسيق ملف Excel المطلوب للاستيراد' : 'Required Excel Format for Import' }}</strong>
      <button mat-icon-button (click)="showTemplateNote=false"><mat-icon>close</mat-icon></button>
    </div>
    <div class="note-body">
      <p>{{ isAr() ? 'الملف يجب أن يحتوي على الأعمدة التالية في الصف الأول (headers):' : 'The file must contain these columns in the first row:' }}</p>
      <div class="cols-table">
        <div class="col-item required"><mat-icon>qr_code</mat-icon> <span><strong>الكود</strong> <em>code</em></span> <span class="opt">{{ isAr() ? 'اختياري — فريد لكل مقاول' : 'Optional — unique identifier' }}</span></div>
        <div class="col-item required"><mat-icon>badge</mat-icon>   <span><strong>الاسم</strong> <em>name</em></span> <span class="req-badge">{{ isAr() ? 'مطلوب' : 'Required' }}</span></div>
        <div class="col-item"><mat-icon>badge</mat-icon>            <span><strong>الاسم بالعربي</strong> <em>nameAr</em></span> <span class="opt">{{ isAr() ? 'اختياري' : 'Optional' }}</span></div>
        <div class="col-item"><mat-icon>phone</mat-icon>            <span><strong>الهاتف</strong> <em>phone</em></span> <span class="opt">{{ isAr() ? 'اختياري' : 'Optional' }}</span></div>
        <div class="col-item"><mat-icon>email</mat-icon>            <span><strong>البريد الإلكتروني</strong> <em>email</em></span> <span class="opt">{{ isAr() ? 'اختياري' : 'Optional' }}</span></div>
      </div>
      <p class="note-tip">💡 {{ isAr() ? 'إذا وُجد كود، سيتم تحديث المقاول الموجود بنفس الكود (upsert). حمّل النموذج الفارغ للبدء.' : 'If a code exists, the matching contractor will be updated (upsert). Download the template to get started.' }}</p>
    </div>
  </div>

  <!-- Import result -->
  <div class="import-result tf-card" *ngIf="importResult">
    <div class="ir-header">
      <mat-icon style="color:#16a34a">check_circle</mat-icon>
      <strong>{{ isAr() ? 'نتيجة الاستيراد' : 'Import Result' }}</strong>
      <button mat-icon-button (click)="importResult=null"><mat-icon>close</mat-icon></button>
    </div>
    <div class="ir-stats">
      <span class="ir-created">✅ {{ isAr() ? 'مُضاف' : 'Created' }}: {{ importResult.created }}</span>
      <span class="ir-updated">🔄 {{ isAr() ? 'مُحدَّث' : 'Updated' }}: {{ importResult.updated }}</span>
      <span class="ir-skipped" *ngIf="importResult.skipped">⚠️ {{ isAr() ? 'تم تخطيه' : 'Skipped' }}: {{ importResult.skipped }}</span>
    </div>
    <ul class="ir-errors" *ngIf="importResult.errors?.length">
      <li *ngFor="let e of importResult.errors">{{ e }}</li>
    </ul>
  </div>

  <!-- Search + uploading indicator -->
  <div class="search-wrap tf-card">
    <mat-icon class="search-icon">search</mat-icon>
    <input class="search-input" [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()"
      [placeholder]="isAr() ? 'ابحث بالكود أو الاسم أو الهاتف...' : 'Search by code, name, phone...'" />
    <mat-spinner *ngIf="importing() || downloading() || exporting()" diameter="20"></mat-spinner>
    <button mat-icon-button *ngIf="searchTerm && !importing()" (click)="searchTerm=''; applyFilter()">
      <mat-icon>close</mat-icon>
    </button>
    <span class="result-count">{{ filtered().length }} {{ isAr() ? 'نتيجة' : 'results' }}</span>
    <button mat-icon-button (click)="showTemplateNote=!showTemplateNote" [matTooltip]="isAr() ? 'تنسيق Excel' : 'Excel format'">
      <mat-icon>help_outline</mat-icon>
    </button>
  </div>

  <!-- Loading -->
  <div class="loading-center" *ngIf="loading()"><mat-spinner diameter="48"></mat-spinner></div>

  <!-- Grid -->
  <div class="cards-grid" *ngIf="!loading()">
    <div class="entity-card tf-card" *ngFor="let c of filtered()">
      <div class="card-header">
        <div class="avatar">{{ (c.name || '?')[0].toUpperCase() }}</div>
        <div class="card-info">
          <div class="card-name">{{ c.name }}</div>
          <div class="card-sub" *ngIf="c.nameAr">{{ c.nameAr }}</div>
        </div>
        <div class="card-badge"><mat-icon>receipt_long</mat-icon> {{ c._count?.extracts ?? 0 }}</div>
      </div>
      <div class="card-body">
        <div class="detail-row code-row" *ngIf="c.code">
          <mat-icon>qr_code</mat-icon> <span class="code-badge">{{ c.code }}</span>
        </div>
        <div class="detail-row" *ngIf="c.phone">
          <mat-icon>phone</mat-icon> <span>{{ c.phone }}</span>
        </div>
        <div class="detail-row" *ngIf="c.email">
          <mat-icon>email</mat-icon> <span>{{ c.email }}</span>
        </div>
        <div class="detail-row no-data" *ngIf="!c.code && !c.phone && !c.email">
          <mat-icon>info</mat-icon> <span class="text-muted">{{ isAr() ? 'لا توجد بيانات إضافية' : 'No additional data' }}</span>
        </div>
      </div>
      <div class="card-footer">
        <span class="status-chip" [class.active]="c.isActive" [class.inactive]="!c.isActive">
          {{ c.isActive ? (isAr() ? 'نشط' : 'Active') : (isAr() ? 'غير نشط' : 'Inactive') }}
        </span>
        <div class="card-actions" *ngIf="canEditDelete()">
          <button mat-icon-button color="primary" (click)="openForm(c)" [matTooltip]="isAr() ? 'تعديل' : 'Edit'">
            <mat-icon>edit</mat-icon>
          </button>
          <button mat-icon-button color="warn" (click)="deleteItem(c.id, c.name)" [matTooltip]="isAr() ? 'حذف' : 'Delete'">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>
    </div>

    <div class="empty-state" *ngIf="filtered().length === 0">
      <mat-icon>domain_disabled</mat-icon>
      <h3>{{ isAr() ? 'لا يوجد مقاولون' : 'No Contractors' }}</h3>
      <p>{{ searchTerm ? (isAr() ? 'لا توجد نتائج للبحث' : 'No results') : (isAr() ? 'أضف أول مقاول أو استورد من Excel' : 'Add a contractor or import from Excel') }}</p>
      <div class="empty-actions" *ngIf="canWrite() && !searchTerm">
        <button mat-raised-button color="primary" (click)="openForm(null)"><mat-icon>add</mat-icon> {{ isAr() ? 'إضافة مقاول' : 'Add Contractor' }}</button>
        <button mat-stroked-button (click)="fileInput.click()"><mat-icon>upload_file</mat-icon> {{ isAr() ? 'استيراد Excel' : 'Import Excel' }}</button>
      </div>
    </div>
  </div>
</div>

<!-- Form Dialog -->
<div class="form-overlay" *ngIf="showForm()">
  <div class="form-backdrop" (click)="closeForm()"></div>
  <div class="form-drawer tf-card">
    <div class="form-header">
      <h3>{{ editId ? (isAr() ? 'تعديل مقاول' : 'Edit Contractor') : (isAr() ? 'مقاول جديد' : 'New Contractor') }}</h3>
      <button mat-icon-button (click)="closeForm()"><mat-icon>close</mat-icon></button>
    </div>
    <div class="form-body">
      <mat-form-field appearance="outline" class="w100">
        <mat-label>{{ isAr() ? 'كود المقاول' : 'Contractor Code' }}</mat-label>
        <input matInput [(ngModel)]="form.code" [placeholder]="isAr() ? 'مثال: C001' : 'e.g. C001'">
        <mat-icon matPrefix>qr_code</mat-icon>
        <mat-hint>{{ isAr() ? 'اختياري — يُستخدم في البحث والاستيراد' : 'Optional — used in search & import' }}</mat-hint>
      </mat-form-field>
      <mat-form-field appearance="outline" class="w100">
        <mat-label>{{ isAr() ? 'الاسم بالإنجليزية *' : 'Name (English) *' }}</mat-label>
        <input matInput [(ngModel)]="form.name" placeholder="Contractor Name">
      </mat-form-field>
      <mat-form-field appearance="outline" class="w100">
        <mat-label>{{ isAr() ? 'الاسم بالعربي' : 'Arabic Name' }}</mat-label>
        <input matInput [(ngModel)]="form.nameAr" placeholder="اسم المقاول">
      </mat-form-field>
      <mat-form-field appearance="outline" class="w100">
        <mat-label>{{ isAr() ? 'رقم الهاتف' : 'Phone' }}</mat-label>
        <input matInput [(ngModel)]="form.phone" type="tel">
        <mat-icon matPrefix>phone</mat-icon>
      </mat-form-field>
      <mat-form-field appearance="outline" class="w100">
        <mat-label>{{ isAr() ? 'البريد الإلكتروني' : 'Email' }}</mat-label>
        <input matInput [(ngModel)]="form.email" type="email">
        <mat-icon matPrefix>email</mat-icon>
      </mat-form-field>
    </div>
    <div class="form-footer">
      <button mat-button (click)="closeForm()">{{ isAr() ? 'إلغاء' : 'Cancel' }}</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="!form.name?.trim() || saving()">
        <mat-spinner *ngIf="saving()" diameter="16"></mat-spinner>
        <mat-icon *ngIf="!saving()">save</mat-icon>
        {{ isAr() ? 'حفظ' : 'Save' }}
      </button>
    </div>
  </div>
</div>
  `,
  styles: [`
    .header-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }

    /* Template note */
    .template-note { padding:16px; margin-bottom:16px; border-right:4px solid #2563eb; background:#eff6ff; }
    .note-header { display:flex; align-items:center; gap:8px; margin-bottom:12px; mat-icon{color:#2563eb;} strong{flex:1;font-size:14px;} }
    .note-body p { font-size:13px; color:var(--text-secondary); margin-bottom:10px; }
    .cols-table { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
    .col-item { display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; background:rgba(255,255,255,.7);
      mat-icon{font-size:16px;color:#64748b;} span{flex:1;font-size:13px;} em{color:var(--text-muted);font-size:11px;margin-inline-start:6px;}
    }
    .req-badge { background:#fef2f2; color:#dc2626; font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px; white-space:nowrap; }
    .opt       { background:#f1f5f9; color:#64748b; font-size:10px; padding:2px 8px; border-radius:10px; white-space:nowrap; }
    .note-tip  { font-size:12px; color:#2563eb; background:rgba(37,99,235,.07); padding:8px 12px; border-radius:8px; margin:0 !important; }

    /* Import result */
    .import-result { padding:14px 16px; margin-bottom:16px; border-right:4px solid #16a34a; background:#f0fdf4; }
    .ir-header { display:flex; align-items:center; gap:8px; margin-bottom:8px; strong{flex:1;} }
    .ir-stats  { display:flex; gap:16px; font-size:13px; font-weight:600; flex-wrap:wrap; margin-bottom:6px; }
    .ir-created{ color:#16a34a; } .ir-updated{ color:#2563eb; } .ir-skipped{ color:#d97706; }
    .ir-errors { padding-inline-start:20px; font-size:12px; color:#dc2626; margin-top:6px; }

    /* Search */
    .search-wrap { display:flex; align-items:center; gap:10px; padding:10px 16px; margin-bottom:20px;
      .search-icon{color:var(--text-muted);}
      .search-input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:var(--text-primary);}
      .result-count{font-size:12px;color:var(--text-muted);white-space:nowrap;}
    }

    /* Cards */
    .cards-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
    .entity-card { display:flex; flex-direction:column; transition:transform .2s,box-shadow .2s; &:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,.1);} }
    .card-header { display:flex; align-items:center; gap:12px; padding:16px 16px 0; }
    .avatar { width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,var(--color-primary),var(--color-primary-light)); color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:800; flex-shrink:0; }
    .card-info { flex:1; min-width:0; }
    .card-name { font-size:15px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .card-sub  { font-size:12px; color:var(--text-muted); margin-top:2px; }
    .card-badge { display:flex; align-items:center; gap:4px; font-size:12px; font-weight:700; color:var(--color-primary-light); mat-icon{font-size:16px;} }
    .card-body { padding:12px 16px; display:flex; flex-direction:column; gap:6px; flex:1; }
    .detail-row { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-secondary); mat-icon{font-size:16px;color:var(--text-muted);} }
    .code-row .code-badge { font-family:monospace; background:var(--bg-main); padding:2px 8px; border-radius:6px; font-size:12px; font-weight:700; letter-spacing:.5px; color:var(--color-primary); }
    .text-muted { color:var(--text-muted); font-style:italic; }
    .card-footer { display:flex; align-items:center; justify-content:space-between; padding:10px 16px 14px; border-top:1px solid var(--border-color); }
    .status-chip { font-size:11px; font-weight:700; padding:2px 10px; border-radius:20px; &.active{background:#f0fdf4;color:#16a34a;} &.inactive{background:#fef2f2;color:#dc2626;} }
    .empty-state { grid-column:1/-1; text-align:center; padding:80px 24px; color:var(--text-muted); mat-icon{font-size:72px;opacity:.15;display:block;margin:0 auto;} h3{margin:20px 0 8px;font-size:20px;font-weight:700;} p{font-size:14px;margin-bottom:20px;} }
    .empty-actions { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
    .loading-center{display:flex;justify-content:center;padding:80px;}

    /* Form */
    .form-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
    .form-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(3px);}
    .form-drawer{position:relative;z-index:201;width:480px;max-width:calc(100vw - 40px);height:min(90vh,600px);display:flex;flex-direction:column;overflow:hidden;}
    .form-header{display:flex;align-items:center;justify-content:space-between;padding:18px 24px 14px;flex-shrink:0;border-bottom:1px solid var(--border-color);h3{font-size:16px;font-weight:700;margin:0;}}
    .form-body{padding:16px 24px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;flex:1;min-height:0;}
    .form-footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 24px 16px;flex-shrink:0;border-top:1px solid var(--border-color);}
    .w100{width:100%;} button[mat-raised-button]{display:flex;align-items:center;gap:6px;}
  `]
})
export class ContractorsPageComponent implements OnInit {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  all          = signal<any[]>([]);
  filtered     = signal<any[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  importing    = signal(false);
  downloading  = signal(false);
  exporting    = signal(false);
  showForm     = signal(false);
  searchTerm   = '';
  editId: number | null = null;
  form: any    = {};
  showTemplateNote = false;
  importResult: any = null;

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
    this.svc.getContractors().subscribe({
      next: r => { this.loading.set(false); if (r.success) { this.all.set(r.data); this.applyFilter(); } },
      error: () => this.loading.set(false),
    });
  }

  applyFilter() {
    const t = this.searchTerm.trim().toLowerCase();
    if (!t) { this.filtered.set(this.all()); return; }
    this.filtered.set(this.all().filter(c =>
      c.code?.toLowerCase().includes(t) || c.name?.toLowerCase().includes(t) ||
      c.nameAr?.toLowerCase().includes(t) || c.phone?.toLowerCase().includes(t) || c.email?.toLowerCase().includes(t)
    ));
  }

  openForm(item: any | null) {
    this.editId = item?.id ?? null;
    this.form = item ? { code: item.code, name: item.name, nameAr: item.nameAr, phone: item.phone, email: item.email } : {};
    this.showForm.set(true);
  }
  closeForm() { this.showForm.set(false); this.editId = null; this.form = {}; }

  save() {
    if (!this.form.name?.trim()) return;
    this.saving.set(true);
    const req$ = this.editId ? this.svc.updateContractor(this.editId, this.form) : this.svc.createContractor(this.form);
    req$.subscribe({
      next: () => { this.saving.set(false); this.closeForm(); this.load(); this.snack.open(this.isAr() ? 'تم الحفظ ✓' : 'Saved ✓', '', { duration: 2500 }); },
      error: e => { this.saving.set(false); this.snack.open(e.error?.message || 'Error', 'X'); },
    });
  }

  deleteItem(id: number, name: string) {
    if (!confirm(this.isAr() ? `هل أنت متأكد من تعطيل/حذف المقاول: ${name}؟` : `Are you sure you want to delete ${name}?`)) return;
    this.svc.deleteContractor(id).subscribe({
      next: () => { this.load(); this.snack.open(this.isAr() ? 'تم الحذف' : 'Deleted', '✓', { duration: 2500 }); },
      error: e => this.snack.open(e.error?.message || 'Error', 'X'),
    });
  }

  // ── Excel ── (use native fetch to guarantee correct filename)
  downloadTemplate() {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.snack.open(this.isAr() ? 'جاري تحميل النموذج...' : 'Downloading...', '', { duration: 2000 });
    this.fetchAndSave('/contractors/template', 'contractors_template.xlsx')
      .then(() => {
        this.downloading.set(false);
        this.snack.open(this.isAr() ? '✅ تم تحميل النموذج' : '✅ Template downloaded', '', { duration: 3000 });
      })
      .catch(msg => {
        this.downloading.set(false);
        this.snack.open(msg, 'X', { duration: 4000 });
      });
  }

  exportExcel() {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.snack.open(this.isAr() ? 'جاري التصدير...' : 'Exporting...', '', { duration: 2000 });
    const date = new Date().toISOString().slice(0, 10);
    this.fetchAndSave('/contractors/export', `contractors_${date}.xlsx`)
      .then(() => {
        this.exporting.set(false);
        this.snack.open(this.isAr() ? '✅ تم تصدير البيانات' : '✅ Exported successfully', '', { duration: 3000 });
      })
      .catch(msg => {
        this.exporting.set(false);
        this.snack.open(msg, 'X', { duration: 4000 });
      });
  }

  /** Native fetch download — bypasses Angular HttpClient to guarantee a.download filename works */
  private async fetchAndSave(endpoint: string, filename: string): Promise<void> {
    const token = this.auth.getToken();
    const res = await fetch(`${environment.apiUrl}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = 'Download failed';
      try { const j = await res.json(); msg = j.message || msg; } catch {}
      throw msg;
    }
    const blob = await res.blob();
    if (!blob || blob.size === 0) throw (this.isAr() ? 'الملف فارغ' : 'Empty file');

    // Try to get filename from Content-Disposition header
    const cd = res.headers.get('content-disposition');
    const cdMatch = cd && (/filename\*=UTF-8''([^;]+)/i.exec(cd) || /filename="?([^"]+)"?/i.exec(cd));
    const finalName = (cdMatch && cdMatch[1]) ? decodeURIComponent(cdMatch[1]) : filename;

    this.triggerDownload(blob, finalName);
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const validExt = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    if (!validExt) {
      this.snack.open(this.isAr() ? 'يرجى اختيار ملف Excel (.xlsx أو .xls)' : 'Please select an Excel file (.xlsx or .xls)', 'X');
      input.value = '';
      return;
    }
    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      this.snack.open(this.isAr() ? 'حجم الملف كبير جداً (الحد الأقصى 5MB)' : 'File too large (max 5MB)', 'X');
      input.value = '';
      return;
    }

    this.importing.set(true);
    this.importResult = null;
    this.svc.importContractors(file).subscribe({
      next: r => {
        this.importing.set(false);
        (e.target as HTMLInputElement).value = '';
        if (r.success) {
          this.importResult = r.data;
          this.load();
          this.snack.open(
            `${this.isAr() ? 'تم الاستيراد' : 'Import done'}: +${r.data.created} / ~${r.data.updated}`,
            '✓', { duration: 4000 }
          );
        }
      },
      error: err => {
        this.importing.set(false);
        (e.target as HTMLInputElement).value = '';
        this.snack.open(err.error?.message || 'Import failed', 'X');
      },
    });
  }

  private triggerDownload(blob: Blob, filename: string) {
    if (blob.type === 'application/json' || blob.type.includes('text')) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          this.snack.open(parsed.message || (this.isAr() ? 'خطأ في الخادم' : 'Server error'), 'X', { duration: 4000 });
        } catch { this.snack.open(this.isAr() ? 'خطأ في التنزيل' : 'Download error', 'X', { duration: 3000 }); }
      };
      reader.readAsText(blob);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename || 'download.xlsx'; // fallback
    document.body.appendChild(a);
    a.click();
    // Wait 30 seconds before revoking to prevent Chrome/Edge from using UUID filenames!
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 30000);
  }
}
