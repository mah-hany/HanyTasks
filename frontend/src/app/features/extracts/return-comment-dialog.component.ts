import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ExtractService } from '../../core/services/extract.service';
import { LangService } from '../../core/services/lang.service';

export interface ReturnDialogData {
  extractId: number;
  extractNumber: number;
  contractorName: string;
  projectName: string;
  fromStatus: string;
}

@Component({
  selector: 'app-return-comment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="dialog-wrap">
      <div class="dialog-header">
        <div class="icon-wrap"><mat-icon>assignment_return</mat-icon></div>
        <div>
          <h2>{{ isAr() ? 'إرجاع المستخلص رقم' : 'Return Extract #' }} {{ data.extractNumber }}</h2>
          <p>{{ data.contractorName }} — {{ data.projectName }}</p>
        </div>
      </div>

      <div class="dialog-body">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>{{ isAr() ? 'سبب الإرجاع *' : 'Return Reason *' }}</mat-label>
          <textarea matInput [(ngModel)]="comment" rows="4"
            [placeholder]="isAr() ? 'اكتب سبب الإرجاع بالتفصيل...' : 'Describe the return reason in detail...'"
            minlength="10">
          </textarea>
          <mat-error *ngIf="comment.length > 0 && comment.length < 10">
            {{ isAr() ? 'سبب الإرجاع لا يقل عن 10 أحرف' : 'Minimum 10 characters required' }}
          </mat-error>
        </mat-form-field>
        <p class="char-count" [class.valid]="comment.trim().length >= 10">
          {{ comment.trim().length }}/10 {{ isAr() ? 'حرف' : 'chars' }}
        </p>
      </div>

      <div class="dialog-footer">
        <button mat-stroked-button (click)="close()">{{ isAr() ? 'إلغاء' : 'Cancel' }}</button>
        <button mat-raised-button color="warn" (click)="confirm()"
          [disabled]="comment.trim().length < 10 || saving()">
          <mat-spinner *ngIf="saving()" diameter="16"></mat-spinner>
          <mat-icon *ngIf="!saving()">assignment_return</mat-icon>
          {{ isAr() ? 'تأكيد الإرجاع' : 'Confirm Return' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-wrap { min-width: 440px; max-width: 100%; }
    .dialog-header {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 22px 24px 0; background: #fef2f2; border-bottom: 1px solid #fecaca;
      .icon-wrap {
        width: 44px; height: 44px; border-radius: 12px; background: #dc2626;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        mat-icon { color: #fff; }
      }
      h2 { font-size: 16px; font-weight: 700; color: #991b1b; margin: 0; }
      p  { font-size: 13px; color: #b91c1c; margin: 4px 0 16px; }
    }
    .dialog-body { padding: 20px 24px 4px; }
    .w-full { width: 100%; }
    .char-count { font-size: 12px; color: var(--text-muted); margin: 4px 0 0 4px; }
    .char-count.valid { color: #16a34a; }
    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 12px 24px 20px; border-top: 1px solid var(--border-color);
      button { display: flex; align-items: center; gap: 6px; }
    }
  `]
})
export class ReturnCommentDialogComponent {
  comment = '';
  saving  = signal(false);
  isAr    = () => this.lang.getCurrentLang() === 'ar';

  constructor(
    private dialogRef: MatDialogRef<ReturnCommentDialogComponent>,
    private extractService: ExtractService,
    private lang: LangService,
    @Inject(MAT_DIALOG_DATA) public data: ReturnDialogData,
  ) {}

  confirm() {
    if (this.comment.trim().length < 10) return;
    this.saving.set(true);
    this.extractService.updateStatus(this.data.extractId, 'RETURNED', this.comment.trim()).subscribe({
      next: (res) => { this.saving.set(false); this.dialogRef.close(res.data); },
      error: ()  => { this.saving.set(false); },
    });
  }
  close() { this.dialogRef.close(null); }
}
