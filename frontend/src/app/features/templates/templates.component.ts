import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { TaskService } from '../../core/services/task.service';
import { LangService } from '../../core/services/lang.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, MatButtonModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSlideToggleModule, MatProgressSpinnerModule, MatTooltipModule, TranslateModule],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div class="page-title">
          <h1>{{ isAr() ? '🔁 قوالب المهام' : '🔁 Task Templates' }}</h1>
          <p>{{ isAr() ? 'أنشئ مهام جديدة من قوالب جاهزة' : 'Create tasks from reusable templates' }}</p>
        </div>
        <button mat-raised-button color="primary" (click)="openForm()">
          <mat-icon>add</mat-icon>
          {{ isAr() ? 'قالب جديد' : 'New Template' }}
        </button>
      </div>

      <div *ngIf="loading()" class="loading-center"><mat-spinner diameter="40"></mat-spinner></div>

      <!-- Empty state -->
      <div *ngIf="!loading() && !templates().length" class="empty-state">
        <mat-icon>content_copy</mat-icon>
        <h3>{{ isAr() ? 'لا توجد قوالب بعد' : 'No templates yet' }}</h3>
        <p>{{ isAr() ? 'أنشئ قالباً لتسريع إنشاء المهام المتكررة' : 'Create a template to speed up recurring task creation' }}</p>
        <button mat-raised-button color="primary" (click)="openForm()">
          <mat-icon>add</mat-icon>{{ isAr() ? 'إنشاء أول قالب' : 'Create First Template' }}
        </button>
      </div>

      <!-- Templates grid -->
      <div class="templates-grid" *ngIf="!loading() && templates().length">
        <div class="template-card tf-card" *ngFor="let t of templates()">
          <div class="template-header">
            <div class="template-icon" [style.background]="getPriorityBg(t.priority)">
              <mat-icon [style.color]="getPriorityColor(t.priority)">content_copy</mat-icon>
            </div>
            <div style="flex:1">
              <div class="template-name">{{ isAr() && t.nameAr ? t.nameAr : t.name }}</div>
              <div class="template-meta">
                <span class="priority-chip" [class]="t.priority.toLowerCase()">{{ getPriorityLabel(t.priority) }}</span>
                <span *ngIf="t.isGlobal" class="global-badge">
                  <mat-icon inline>public</mat-icon> {{ isAr() ? 'عام' : 'Global' }}
                </span>
                <span *ngIf="t.defaultDuration" class="duration-badge">
                  <mat-icon inline>schedule</mat-icon> {{ t.defaultDuration }} {{ isAr() ? 'يوم' : 'd' }}
                </span>
              </div>
            </div>
          </div>

          <p class="template-desc" *ngIf="t.description">{{ t.description }}</p>

          <!-- Checklist preview -->
          <div class="checklist-preview" *ngIf="getChecklistItems(t).length">
            <div class="checklist-item" *ngFor="let item of getChecklistItems(t).slice(0, 3)">
              <mat-icon inline>check_box_outline_blank</mat-icon>
              {{ isAr() && item.textAr ? item.textAr : item.text }}
            </div>
            <div *ngIf="getChecklistItems(t).length > 3" class="checklist-more">
              +{{ getChecklistItems(t).length - 3 }} {{ isAr() ? 'بنود' : 'more items' }}
            </div>
          </div>

          <div class="template-actions">
            <button mat-stroked-button color="primary" (click)="useTemplate(t)" class="use-btn">
              <mat-icon>play_arrow</mat-icon>
              {{ isAr() ? 'استخدم' : 'Use' }}
            </button>
            <button mat-icon-button (click)="editTemplate(t)" [matTooltip]="isAr() ? 'تعديل' : 'Edit'">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button color="warn" (click)="deleteTemplate(t.id)" [matTooltip]="isAr() ? 'حذف' : 'Delete'">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
      </div>

    <!-- Create/Edit Form Dialog (inline) -->
    <div class="form-overlay" *ngIf="showForm()">
      <div class="form-backdrop" (click)="closeForm()"></div>
      <div class="form-drawer tf-card">
        <div class="form-header">
          <h3>{{ editing() ? (isAr() ? 'تعديل قالب' : 'Edit Template') : (isAr() ? 'قالب جديد' : 'New Template') }}</h3>
          <button mat-icon-button (click)="closeForm()"><mat-icon>close</mat-icon></button>
        </div>

        <div class="form-body">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>{{ isAr() ? 'اسم القالب' : 'Template Name' }}</mat-label>
            <input matInput [(ngModel)]="form.name">
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-100">
            <mat-label>{{ isAr() ? 'الاسم بالعربي' : 'Name (Arabic)' }}</mat-label>
            <input matInput [(ngModel)]="form.nameAr" dir="rtl">
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-100">
            <mat-label>{{ isAr() ? 'الوصف' : 'Description' }}</mat-label>
            <textarea matInput [(ngModel)]="form.description" rows="2"></textarea>
          </mat-form-field>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <mat-form-field appearance="outline">
              <mat-label>{{ isAr() ? 'الأولوية' : 'Priority' }}</mat-label>
              <mat-select [(ngModel)]="form.priority">
                <mat-option value="LOW">{{ isAr() ? 'منخفض' : 'Low' }}</mat-option>
                <mat-option value="MEDIUM">{{ isAr() ? 'متوسط' : 'Medium' }}</mat-option>
                <mat-option value="HIGH">{{ isAr() ? 'عالٍ' : 'High' }}</mat-option>
                <mat-option value="URGENT">{{ isAr() ? 'عاجل' : 'Urgent' }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ isAr() ? 'المدة (أيام)' : 'Duration (days)' }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.defaultDuration" min="1">
            </mat-form-field>
          </div>

          <!-- Checklist items -->
          <div class="checklist-editor">
            <label>{{ isAr() ? 'بنود قائمة التحقق' : 'Checklist Items' }}</label>
            <div class="checklist-edit-item" *ngFor="let item of form.checklistItems; let i = index">
              <mat-icon style="color:var(--text-muted);font-size:18px">drag_handle</mat-icon>
              <input [(ngModel)]="item.text" [placeholder]="isAr() ? 'البند...' : 'Item text...'" class="inline-input">
              <button mat-icon-button (click)="removeChecklistItem(i)" color="warn" style="width:28px;height:28px">
                <mat-icon style="font-size:16px">close</mat-icon>
              </button>
            </div>
            <button mat-stroked-button (click)="addChecklistItem()" style="width:100%;margin-top:8px">
              <mat-icon>add</mat-icon> {{ isAr() ? 'إضافة بند' : 'Add Item' }}
            </button>
          </div>

          <mat-slide-toggle [(ngModel)]="form.isGlobal" *ngIf="isAdmin()" style="margin-top:8px">
            {{ isAr() ? 'قالب عام (لجميع المستخدمين)' : 'Global template (all users)' }}
          </mat-slide-toggle>
        </div>

        <div class="form-footer">
          <button mat-button (click)="closeForm()">{{ isAr() ? 'إلغاء' : 'Cancel' }}</button>
          <button mat-raised-button color="primary" (click)="saveTemplate()" [disabled]="!form.name && !form.nameAr">
            <mat-icon>save</mat-icon> {{ isAr() ? 'حفظ' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .templates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
      align-content: start; /* prevents cards from stretching to fill height */
    }
    .template-card {
      padding: 20px; display: flex; flex-direction: column; gap: 12px;
      transition: transform 0.2s, box-shadow 0.2s;
      &:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); }
    }
    .template-header { display: flex; gap: 12px; align-items: flex-start; }
    .template-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .template-name { font-size: 15px; font-weight: 700; }
    .template-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
    .global-badge, .duration-badge { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 2px; }
    .template-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
    .checklist-preview { background: var(--bg-main); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
    .checklist-item { font-size: 12px; display: flex; align-items: center; gap: 6px; color: var(--text-secondary); mat-icon { font-size: 14px; color: var(--text-muted); } }
    .checklist-more { font-size: 11px; color: var(--text-muted); padding-left: 20px; }
    .template-actions { display: flex; gap: 8px; align-items: center; margin-top: auto; }
    .use-btn { flex: 1; }
    .empty-state {
      text-align: center; padding: 100px 24px; color: var(--text-muted);
      grid-column: 1 / -1; /* span full grid width */
      mat-icon { font-size: 72px; opacity: 0.15; display: block; margin: 0 auto; }
      h3 { margin: 20px 0 8px; font-size: 20px; font-weight: 700; }
      p { font-size: 14px; margin-bottom: 24px; }
    }
    .loading-center { display: flex; justify-content: center; padding: 60px; grid-column: 1 / -1; }
    
    .form-overlay { 
      position: fixed; inset: 0; z-index: 200; 
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    }
    .form-backdrop {
      position: absolute; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);
    }
    .form-drawer {
      position: relative; z-index: 201;
      width: 540px; max-width: calc(100vw - 40px);
      height: min(90vh, 720px);   /* ← KEY FIX: explicit height so flex:1 works on form-body */
      display: flex; flex-direction: column;
      padding: 0; overflow: hidden;
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.2);
      animation: scaleIn 0.22s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes scaleIn {
      from { transform: scale(0.92); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
    .form-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px 16px; flex-shrink: 0;
      border-bottom: 1px solid var(--border-color);
      h3 { font-size: 16px; font-weight: 700; margin: 0; }
    }
    .form-body {
      padding: 16px 24px; display: flex; flex-direction: column;
      gap: 12px; overflow-y: auto; flex: 1; min-height: 0; /* min-height:0 is essential for flex scroll */
    }
    .form-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 24px 18px; flex-shrink: 0; border-top: 1px solid var(--border-color); }
    .checklist-editor { label { font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 8px; } }
    .checklist-edit-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .inline-input { flex: 1; border: 1px solid var(--border-color); border-radius: 6px; padding: 6px 10px; font-size: 13px; outline: none; background: var(--bg-main); color: var(--text-primary); transition: border-color 0.2s; &:focus { border-color: var(--color-primary-light); } }
  `]
})
export class TemplatesComponent implements OnInit {
  templates = signal<any[]>([]);
  loading = signal(true);
  showForm = signal(false);
  editing = signal<any>(null);
  isAr = () => this.langService.getCurrentLang() === 'ar';
  isAdmin = () => this.authService.hasRoleLevel(2);

  form: any = { name: '', nameAr: '', description: '', priority: 'MEDIUM', defaultDuration: null, checklistItems: [], isGlobal: false };

  constructor(
    private taskService: TaskService,
    private langService: LangService,
    private authService: AuthService,
    private snack: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.taskService.getTemplates().subscribe({
      next: r => { this.loading.set(false); if (r.success) this.templates.set(r.data); },
      error: () => this.loading.set(false),
    });
  }

  openForm() { this.form = { name: '', nameAr: '', description: '', priority: 'MEDIUM', defaultDuration: null, checklistItems: [], isGlobal: false }; this.editing.set(null); this.showForm.set(true); }
  closeForm() { this.showForm.set(false); this.editing.set(null); }

  editTemplate(t: any) {
    this.editing.set(t);
    this.form = { name: t.name, nameAr: t.nameAr || '', description: t.description || '', priority: t.priority, defaultDuration: t.defaultDuration, checklistItems: this.getChecklistItems(t), isGlobal: t.isGlobal };
    this.showForm.set(true);
  }

  addChecklistItem() { this.form.checklistItems.push({ text: '', textAr: '' }); }
  removeChecklistItem(i: number) { this.form.checklistItems.splice(i, 1); }

  saveTemplate() {
    if (!this.form.name && this.form.nameAr) {
      this.form.name = this.form.nameAr; // fallback: use Arabic name as English name
    }
    if (!this.form.name && !this.form.nameAr) {
      this.snack.open(this.isAr() ? 'يجب إدخال اسم القالب' : 'Template name is required', 'X', { duration: 3000 });
      return;
    }
    const payload = { ...this.form, checklistItems: this.form.checklistItems.filter((i: any) => i.text.trim() || i.textAr?.trim()) };
    const req = this.editing() ? this.taskService.updateTemplate(this.editing().id, payload) : this.taskService.createTemplate(payload);
    req.subscribe({
      next: () => { this.snack.open(this.isAr() ? 'تم الحفظ' : 'Saved', '✓', { duration: 2000 }); this.closeForm(); this.load(); },
      error: () => this.snack.open(this.isAr() ? 'حدث خطأ' : 'Error', 'X'),
    });
  }

  deleteTemplate(id: number) {
    this.taskService.deleteTemplate(id).subscribe({
      next: () => { this.snack.open(this.isAr() ? 'تم الحذف' : 'Deleted', '✓', { duration: 2000 }); this.load(); },
      error: () => this.snack.open(this.isAr() ? 'حدث خطأ' : 'Error', 'X'),
    });
  }

  useTemplate(t: any) {
    this.router.navigate(['/tasks'], { queryParams: { templateId: t.id } });
  }

  getChecklistItems(t: any): any[] {
    if (!t.checklistItems) return [];
    try { return JSON.parse(t.checklistItems); } catch { return []; }
  }

  getPriorityColor(p: string): string { return { URGENT: '#dc2626', HIGH: '#ea580c', MEDIUM: '#2563eb', LOW: '#16a34a' }[p] || '#888'; }
  getPriorityBg(p: string): string { return { URGENT: '#fef2f2', HIGH: '#fff7ed', MEDIUM: '#eff6ff', LOW: '#f0fdf4' }[p] || '#f8fafc'; }
  getPriorityLabel(p: string): string {
    if (this.isAr()) return { LOW: 'منخفض', MEDIUM: 'متوسط', HIGH: 'عالٍ', URGENT: 'عاجل' }[p] || p;
    return p;
  }
}
