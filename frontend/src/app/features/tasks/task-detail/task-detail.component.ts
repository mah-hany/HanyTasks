import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TaskService } from '../../../core/services/task.service';
import { AuthService } from '../../../core/services/auth.service';
import { LangService } from '../../../core/services/lang.service';
import { TimeTrackerComponent } from './time-tracker.component';
import { TaskFormDialogComponent } from '../task-form-dialog/task-form-dialog.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, MatButtonModule, MatChipsModule, MatProgressBarModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MatMenuModule, MatCheckboxModule, MatDialogModule, TranslateModule, DatePipe, TimeTrackerComponent],
  template: `
    <div class="page-container fade-in">
      <div *ngIf="loading()" class="loading-center"><mat-spinner diameter="48"></mat-spinner></div>

      <ng-container *ngIf="!loading() && task()">
        <!-- Back + Actions header -->
        <div class="page-header">
          <div class="page-title">
            <a routerLink="/tasks" class="back-link">
              <mat-icon>arrow_back</mat-icon>
              {{ isAr() ? 'المهام' : 'Tasks' }}
            </a>
            <h1>{{ isAr() && task()?.titleAr ? task()?.titleAr : task()?.title }}</h1>
            <p>{{ task()?.taskCode }}</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <!-- Inline Delete Confirmation -->
            <ng-container *ngIf="!confirmDelete(); else confirmDeleteTpl">
              <button mat-stroked-button color="primary" *ngIf="authService.hasRoleLevel(1)" (click)="editTask()">
                <mat-icon>edit</mat-icon> {{ isAr() ? 'تعديل المهمة' : 'Edit Task' }}
              </button>
              <button mat-stroked-button color="warn" *ngIf="authService.hasRoleLevel(2)" (click)="confirmDelete.set(true)">
                <mat-icon>delete</mat-icon> {{ isAr() ? 'حذف المهمة' : 'Delete Task' }}
              </button>
            </ng-container>
            <ng-template #confirmDeleteTpl>
              <span style="font-size:13px;color:#dc2626;font-weight:600">{{ isAr() ? 'تأكيد الحذف؟' : 'Confirm delete?' }}</span>
              <button mat-raised-button color="warn" (click)="deleteTask()">
                <mat-icon>check</mat-icon> {{ isAr() ? 'نعم، احذف' : 'Yes, Delete' }}
              </button>
              <button mat-stroked-button (click)="confirmDelete.set(false)">
                {{ isAr() ? 'إلغاء' : 'Cancel' }}
              </button>
            </ng-template>

            <button mat-stroked-button [matMenuTriggerFor]="statusMenu" *ngIf="canChangeStatus()">
              <mat-icon>sync_alt</mat-icon> {{ isAr() ? 'تغيير الحالة' : 'Change Status' }}
            </button>
            <mat-menu #statusMenu="matMenu">
              <button mat-menu-item (click)="changeStatus('IN_PROGRESS')"><mat-icon>autorenew</mat-icon>{{ isAr() ? 'قيد التنفيذ' : 'In Progress' }}</button>
              <button mat-menu-item (click)="changeStatus('UNDER_REVIEW')"><mat-icon>rate_review</mat-icon>{{ isAr() ? 'إرسال للمراجعة' : 'Submit for Review' }}</button>
              <button mat-menu-item (click)="changeStatus('REVISION_REQUIRED')" *ngIf="canReview()"><mat-icon>edit_note</mat-icon>{{ isAr() ? 'تحتاج تعديل' : 'Revision Required' }}</button>
              <button mat-menu-item (click)="changeStatus('COMPLETED')" *ngIf="canReview()"><mat-icon>check_circle</mat-icon>{{ isAr() ? 'اعتماد واكتمال' : 'Approve & Complete' }}</button>
            </mat-menu>
          </div>
        </div>

        <div class="detail-grid">
          <!-- Left: Main Info -->
          <div class="detail-main">
            <!-- Info Card -->
            <div class="tf-card info-card">
              <div class="info-grid">
                <div class="info-item">
                  <label>{{ isAr() ? 'الحالة' : 'Status' }}</label>
                  <span class="status-chip" [class]="getStatusClass(task()?.status)">{{ getStatusLabel(task()?.status) }}</span>
                </div>
                <div class="info-item">
                  <label>{{ isAr() ? 'الأولوية' : 'Priority' }}</label>
                  <span class="priority-chip" [class]="task()?.priority?.toLowerCase()">{{ getPriorityLabel(task()?.priority) }}</span>
                </div>
                <div class="info-item">
                  <label>{{ 'TASKS.ASSIGNED_TO' | translate }}</label>
                  <div class="user-chip">
                    <div class="mini-avatar-sm">{{ getInitial(isAr() ? task()?.assignedTo?.fullNameAr : task()?.assignedTo?.fullName) }}</div>
                    <span>{{ isAr() ? task()?.assignedTo?.fullNameAr : task()?.assignedTo?.fullName }}</span>
                  </div>
                </div>
                <div class="info-item">
                  <label>{{ 'TASKS.CREATED_BY' | translate }}</label>
                  <span>{{ isAr() ? task()?.createdBy?.fullNameAr : task()?.createdBy?.fullName }}</span>
                </div>
                <div class="info-item" *ngIf="task()?.dueDate">
                  <label>{{ 'TASKS.DUE_DATE' | translate }}</label>
                  <span [style.color]="isOverdue() ? '#dc2626' : 'inherit'" style="font-weight:600">
                    {{ task()?.dueDate | date:'dd/MM/yyyy' }}
                  </span>
                </div>
                <div class="info-item" *ngIf="task()?.category">
                  <label>{{ isAr() ? 'التصنيف' : 'Category' }}</label>
                  <span>{{ isAr() ? task()?.category?.nameAr : task()?.category?.name }}</span>
                </div>
              </div>

              <!-- Progress -->
              <div class="progress-section">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <label>{{ 'TASKS.PROGRESS' | translate }}</label>
                  <span style="font-weight:800;color:var(--color-primary-light)">{{ task()?.progressPercent }}%</span>
                </div>
                <div class="tf-progress" style="height:10px;border-radius:5px">
                  <div class="tf-progress__fill" [style.width]="task()?.progressPercent + '%'"></div>
                </div>
                <div *ngIf="isAssignee()" style="margin-top:12px">
                  <input type="range" min="0" max="100" [value]="task()?.progressPercent"
                         (change)="updateProgress($event)" style="width:100%">
                </div>
              </div>

              <!-- Description -->
              <div class="description-section" *ngIf="task()?.description">
                <label>{{ 'COMMON.DESCRIPTION' | translate }}</label>
                <p>{{ task()?.description }}</p>
              </div>

              <!-- Checklist -->
              <div class="checklist-section">
                <div class="checklist-header">
                  <label>{{ isAr() ? '✅ قائمة التحقق' : '✅ Checklist' }}
                    <span class="checklist-count" *ngIf="task()?.checklist?.length">
                      {{ completedChecklistCount() }}/{{ task()?.checklist?.length }}
                    </span>
                  </label>
                </div>

                <!-- Progress bar for checklist -->
                <div *ngIf="task()?.checklist?.length" class="tf-progress" style="height:6px;margin-bottom:12px">
                  <div class="tf-progress__fill" [style.width]="checklistProgress() + '%'"></div>
                </div>

                <!-- Items -->
                <div class="checklist-list">
                  <div class="checklist-item" *ngFor="let item of task()?.checklist">
                    <mat-checkbox
                      [checked]="item.isCompleted"
                      (change)="toggleChecklist(item, $event.checked)"
                      [disabled]="!isAssignee() && !canReview()">
                    </mat-checkbox>
                    <span [class.completed-text]="item.isCompleted">
                      {{ isAr() && item.textAr ? item.textAr : item.text }}
                    </span>
                    <button mat-icon-button style="width:24px;height:24px;margin-inline-start:auto"
                      *ngIf="isAssignee() || canReview()"
                      (click)="deleteChecklist(item.id)">
                      <mat-icon style="font-size:14px">close</mat-icon>
                    </button>
                  </div>
                </div>

                <!-- Add new item -->
                <div class="add-checklist" *ngIf="isAssignee() || canReview()">
                  <input class="checklist-input" [(ngModel)]="newChecklistText"
                    [placeholder]="isAr() ? 'أضف بنداً جديداً...' : 'Add a checklist item...'"
                    (keyup.enter)="addChecklist()">
                  <button mat-icon-button color="primary" (click)="addChecklist()" [disabled]="!newChecklistText.trim()">
                    <mat-icon>add_circle</mat-icon>
                  </button>
                </div>
              </div>
            </div>

            <!-- Timeline -->
            <div class="tf-card timeline-card">
              <h3>{{ 'TASKS.TIMELINE' | translate }}</h3>
              <div class="timeline">
                <div class="timeline-item" *ngFor="let h of task()?.statusHistory">
                  <div class="timeline-dot" [style.background]="getStatusColor(h.toStatus)"></div>
                  <div class="timeline-content">
                    <div class="timeline-status">{{ getStatusLabel(h.toStatus) }}</div>
                    <div class="timeline-meta">
                      {{ isAr() ? h.changedBy?.fullNameAr : h.changedBy?.fullName }} · {{ h.changeDate | date:'dd/MM/yyyy HH:mm' }}
                    </div>
                    <div class="timeline-note" *ngIf="h.note">{{ h.note }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Time Tracker + Comments + Attachments -->
          <div class="detail-side">
            <!-- Time Tracker -->
            <app-time-tracker></app-time-tracker>

            <!-- Comments -->
            <div class="tf-card comments-card">
              <h3>{{ 'TASKS.COMMENTS' | translate }} ({{ task()?.comments?.length }})</h3>
              <div class="comments-list">
                <div class="comment-item" *ngFor="let c of task()?.comments">
                  <div class="mini-avatar-sm">{{ getInitial(isAr() ? c.user?.fullNameAr : c.user?.fullName) }}</div>
                  <div class="comment-body">
                    <div class="comment-author">{{ isAr() ? c.user?.fullNameAr : c.user?.fullName }}</div>
                    <div class="comment-text" [class.manager-note]="c.isManagerNote">{{ c.commentText }}</div>
                    <div class="comment-date">{{ c.commentDate | date:'dd/MM/yyyy HH:mm' }}</div>
                  </div>
                </div>
              </div>
              <!-- Add Comment -->
              <div class="add-comment">
                <mat-form-field appearance="outline" class="w-100">
                  <mat-label>{{ 'TASKS.ADD_COMMENT' | translate }}</mat-label>
                  <textarea matInput [(ngModel)]="newComment" rows="2"></textarea>
                </mat-form-field>
                <button mat-raised-button color="primary" (click)="addComment()" [disabled]="!newComment.trim()">
                  <mat-icon>send</mat-icon>
                </button>
              </div>
            </div>

            <!-- Attachments -->
            <div class="tf-card attachments-card">
              <h3>{{ 'TASKS.ATTACHMENTS' | translate }} ({{ task()?.attachments?.length }})</h3>
              <div class="attachment-list">
                <div class="attachment-item" *ngFor="let att of task()?.attachments">
                  <a [href]="getFileUrl(att.fileUrl)" target="_blank" style="display:flex;align-items:center;gap:8px;flex:1;color:inherit;text-decoration:none;">
                    <mat-icon>attach_file</mat-icon>
                    <span>{{ att.fileName }}</span>
                  </a>
                  <small>{{ formatSize(att.fileSize) }}</small>
                  <button mat-icon-button color="warn" style="width:24px;height:24px;line-height:24px;margin-inline-start:4px" 
                          (click)="deleteAttachment(att.id)" *ngIf="isAssignee() || canReview()">
                    <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
                  </button>
                </div>
              </div>
              <!-- Upload -->
              <div class="upload-zone" (click)="fileInput.click()" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
                <mat-icon>cloud_upload</mat-icon>
                <p>{{ isAr() ? 'اسحب الملفات هنا أو انقر للرفع' : 'Drag files or click to upload' }}</p>
              </div>
              <input #fileInput type="file" hidden (change)="onFileChange($event)">
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .back-link {
      display: flex; align-items: center; gap: 4px;
      color: var(--text-secondary); text-decoration: none; font-size: 13px;
      margin-bottom: 6px;
      &:hover { color: var(--color-primary); }
    }

    .detail-grid {
      display: grid; grid-template-columns: 1fr 360px; gap: 20px;
      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    .info-card, .timeline-card, .comments-card, .attachments-card { padding: 20px; margin-bottom: 16px; }

    .info-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;
      label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; display: block; }
    }

    .user-chip {
      display: flex; align-items: center; gap: 6px;
    }

    .mini-avatar-sm {
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--color-primary); color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; flex-shrink: 0;
    }

    .progress-section { padding: 16px 0; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); margin-bottom: 16px; }
    .description-section { label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; display: block; } p { font-size: 14px; line-height: 1.7; } }
    .checklist-section { padding: 16px 0; border-top: 1px solid var(--border-color); margin-top: 16px; }
    .checklist-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; label { font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; } }
    .checklist-count { background: var(--color-primary-light); color: white; border-radius: 20px; padding: 1px 8px; font-size: 11px; font-weight: 700; }
    .checklist-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    .checklist-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; transition: background var(--transition); &:hover { background: var(--bg-main); } }
    .completed-text { text-decoration: line-through; color: var(--text-muted); }
    .add-checklist { display: flex; align-items: center; gap: 6px; }
    .checklist-input { flex: 1; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; font-size: 13px; outline: none; background: var(--bg-main); color: var(--text-primary); transition: border-color var(--transition); &:focus { border-color: var(--color-primary-light); } }

    .timeline { display: flex; flex-direction: column; gap: 0; padding-top: 12px; }
    .timeline-item {
      display: flex; gap: 12px; padding-bottom: 20px; position: relative;
      &::before { content: ''; position: absolute; top: 12px; inset-inline-start: 5px; width: 2px; height: 100%; background: var(--border-color); }
      &:last-child::before { display: none; }
    }
    .timeline-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
    .timeline-content { flex: 1; }
    .timeline-status { font-weight: 700; font-size: 13px; }
    .timeline-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .timeline-note { font-size: 12px; background: var(--bg-main); border-radius: 6px; padding: 6px 10px; margin-top: 6px; }

    .comments-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .comment-item { display: flex; gap: 8px; }
    .comment-body { flex: 1; }
    .comment-author { font-size: 12px; font-weight: 700; margin-bottom: 3px; }
    .comment-text { font-size: 13px; background: var(--bg-main); border-radius: 8px; padding: 8px 12px; line-height: 1.5; &.manager-note { background: rgba(241,143,1,0.08); border-inline-start: 2px solid var(--color-accent); } }
    .comment-date { font-size: 10px; color: var(--text-muted); margin-top: 3px; }
    .add-comment { display: flex; gap: 8px; align-items: flex-end; }

    .attachment-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .attachment-item {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      background: var(--bg-main); border-radius: 8px; text-decoration: none;
      color: var(--text-primary); font-size: 13px; transition: background var(--transition);
      &:hover { background: var(--border-color); }
      mat-icon { color: var(--color-primary-light); }
      small { margin-inline-start: auto; color: var(--text-muted); font-size: 11px; }
    }

    .upload-zone {
      border: 2px dashed var(--border-color); border-radius: 10px; padding: 20px;
      text-align: center; cursor: pointer; color: var(--text-muted);
      transition: all var(--transition);
      mat-icon { font-size: 32px; opacity: 0.4; }
      p { font-size: 12px; margin-top: 4px; }
      &:hover { border-color: var(--color-primary-light); color: var(--color-primary-light); }
    }

    .loading-center { display: flex; justify-content: center; padding: 80px; }
  `],
})
export class TaskDetailComponent implements OnInit {
  task = signal<any>(null);
  loading = signal(true);
  confirmDelete = signal(false);
  newComment = '';
  newChecklistText = '';
  isAr = () => this.langService.getCurrentLang() === 'ar';
  canChangeStatus = () => true;
  canReview = () => this.authService.hasRoleLevel(3);
  isAssignee = () => this.task()?.assignedTo?.id === this.authService.currentUser()?.id;
  isOverdue = () => this.task()?.dueDate && new Date(this.task()?.dueDate) < new Date() && this.task()?.status !== 'COMPLETED';
  completedChecklistCount = () => (this.task()?.checklist || []).filter((i: any) => i.isCompleted).length;
  checklistProgress = () => { const l = this.task()?.checklist?.length || 0; return l ? Math.round(this.completedChecklistCount() / l * 100) : 0; };

  STATUS_COLORS: Record<string, string> = {
    NEW: '#94a3b8', IN_PROGRESS: '#3b82f6', UNDER_REVIEW: '#a855f7',
    REVISION_REQUIRED: '#f97316', COMPLETED: '#22c55e', CANCELLED: '#ef4444',
  };

  constructor(
    private taskService: TaskService,
    public authService: AuthService,
    private langService: LangService,
    private route: ActivatedRoute,
    private snack: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit() {
    const id = +this.route.snapshot.params['id'];
    this.loadTask(id);
  }

  loadTask(id: number) {
    this.taskService.getById(id).subscribe({
      next: (res) => { this.loading.set(false); if (res.success) this.task.set(res.data); },
      error: () => this.loading.set(false),
    });
  }

  changeStatus(status: string) {
    this.taskService.updateStatus(this.task().id, status).subscribe({
      next: () => { this.loadTask(this.task().id); this.snack.open(this.isAr() ? 'تم تغيير الحالة' : 'Status updated', '✓', { duration: 2500 }); },
      error: (err) => this.snack.open(err.error?.message || 'Error', 'X'),
    });
  }

  updateProgress(event: Event) {
    const v = +(event.target as HTMLInputElement).value;
    this.taskService.updateProgress(this.task().id, v).subscribe({
      next: () => { this.task.update(t => ({ ...t, progressPercent: v })); },
    });
  }

  addComment() {
    if (!this.newComment.trim()) return;
    this.taskService.addComment(this.task().id, this.newComment).subscribe({
      next: (res) => {
        this.task.update(t => ({ ...t, comments: [...t.comments, res.data] }));
        this.newComment = '';
      },
    });
  }

  addChecklist() {
    if (!this.newChecklistText.trim()) return;
    this.taskService.addChecklistItem(this.task().id, this.newChecklistText).subscribe({
      next: (res) => {
        this.task.update(t => ({ ...t, checklist: [...(t.checklist || []), res.data] }));
        this.newChecklistText = '';
      },
    });
  }

  toggleChecklist(item: any, checked: boolean) {
    this.taskService.toggleChecklistItem(this.task().id, item.id, checked).subscribe({
      next: () => {
        this.task.update(t => ({
          ...t,
          checklist: t.checklist.map((i: any) => i.id === item.id ? { ...i, isCompleted: checked } : i),
          progressPercent: this.checklistProgress(),
        }));
      },
    });
  }

  deleteChecklist(itemId: number) {
    this.taskService.deleteChecklistItem(this.task().id, itemId).subscribe({
      next: () => {
        this.task.update(t => ({ ...t, checklist: t.checklist.filter((i: any) => i.id !== itemId) }));
        this.snack.open(this.isAr() ? 'تم الحذف' : 'Deleted', '✓', { duration: 1500 });
      },
    });
  }

  onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.uploadFile(file);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadFile(file);
  }

  uploadFile(file: File) {
    this.taskService.uploadAttachment(this.task().id, file).subscribe({
      next: (res) => {
        this.task.update(t => ({ ...t, attachments: [...t.attachments, res.data] }));
        this.snack.open(this.isAr() ? 'تم رفع الملف' : 'File uploaded', '✓', { duration: 2500 });
      },
    });
  }

  deleteAttachment(attId: number) {
    if (!confirm(this.isAr() ? 'هل أنت متأكد من حذف هذا المرفق؟' : 'Are you sure you want to delete this attachment?')) return;
    this.taskService.deleteAttachment(this.task().id, attId).subscribe({
      next: () => {
        this.task.update(t => ({ ...t, attachments: t.attachments.filter((a: any) => a.id !== attId) }));
        this.snack.open(this.isAr() ? 'تم حذف المرفق' : 'Attachment deleted', '✓', { duration: 2500 });
      },
      error: (err) => this.snack.open(err.error?.message || 'Error', 'X', { duration: 3000 })
    });
  }

  getInitial(name?: string) { return name ? name.charAt(0).toUpperCase() : '?'; }
  getFileUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${environment.socketUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  formatSize(bytes: number) { return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`; }
  getStatusColor(s: string) { return this.STATUS_COLORS[s] || '#888'; }

  getStatusLabel(s?: string): string {
    const m: Record<string, string[]> = {
      NEW: ['New', 'جديدة'], IN_PROGRESS: ['In Progress', 'قيد التنفيذ'],
      UNDER_REVIEW: ['Under Review', 'تحت المراجعة'], REVISION_REQUIRED: ['Revision Required', 'تحتاج تعديل'],
      COMPLETED: ['Completed', 'مكتملة'], CANCELLED: ['Cancelled', 'ملغاة'],
    };
    return (s && m[s]) ? (this.isAr() ? m[s][1] : m[s][0]) : (s || '');
  }

  getStatusClass(s?: string): string {
    return { NEW: 'new', IN_PROGRESS: 'in-progress', UNDER_REVIEW: 'under-review', REVISION_REQUIRED: 'revision', COMPLETED: 'completed', CANCELLED: 'cancelled' }[s || ''] || '';
  }

  getPriorityLabel(p?: string): string {
    if (!p) return '';
    if (this.isAr()) return { LOW: 'منخفض', MEDIUM: 'متوسط', HIGH: 'عالٍ', URGENT: 'عاجل' }[p] || p;
    return p;
  }

  deleteTask() {
    this.taskService.delete(this.task().id).subscribe({
      next: (res) => {
        if (res.success) {
          this.snack.open(this.isAr() ? 'تم الحذف بنجاح' : 'Deleted successfully', 'OK', { duration: 3000 });
          window.location.href = '/tasks';
        }
      },
      error: (err) => {
        this.confirmDelete.set(false);
        this.snack.open(err.error?.message || 'Error occurred', 'OK', { duration: 3000 });
      }
    });
  }

  editTask() {
    const ref = this.dialog.open(TaskFormDialogComponent, { 
      width: '600px', 
      disableClose: true, 
      panelClass: 'task-dialog',
      data: { task: this.task() }
    });
    ref.afterClosed().subscribe(result => { 
      if (result) this.loadTask(this.task().id); 
    });
  }
}
