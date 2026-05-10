import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { TaskService } from '../../../core/services/task.service';
import { UserService } from '../../../core/services/user.service';
import { LangService } from '../../../core/services/lang.service';

@Component({
  selector: 'app-task-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
    MatDatepickerModule, MatNativeDateModule, MatProgressSpinnerModule, TranslateModule],
  template: `
    <div class="dialog-wrapper">
      <div mat-dialog-title class="dialog-title">
        <div class="dialog-title-left">
          <div class="title-icon"><mat-icon>task_alt</mat-icon></div>
          <div>
            <h2>{{ 'TASKS.NEW_TASK' | translate }}</h2>
            <p>{{ isAr() ? 'أنشئ مهمة جديدة وأسندها' : 'Create and assign a new task' }}</p>
          </div>
        </div>
        <button mat-icon-button (click)="close()"><mat-icon>close</mat-icon></button>
      </div>

      <mat-dialog-content>
        <form [formGroup]="form" class="task-form">
          <div class="form-row">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>{{ isAr() ? 'عنوان المهمة' : 'Task Title' }}</mat-label>
              <input matInput formControlName="title" required>
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>{{ isAr() ? 'عنوان المهمة (عربي)' : 'Task Title (Arabic)' }}</mat-label>
              <input matInput formControlName="titleAr">
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>{{ 'COMMON.DESCRIPTION' | translate }}</mat-label>
              <textarea matInput formControlName="description" rows="3"></textarea>
            </mat-form-field>
          </div>

          <div class="form-row-2">
            <mat-form-field appearance="outline">
              <mat-label>{{ isAr() ? 'الأولوية' : 'Priority' }}</mat-label>
              <mat-select formControlName="priority">
                <mat-option value="URGENT"><span class="priority-dot urgent"></span>{{ isAr() ? 'عاجل' : 'Urgent' }}</mat-option>
                <mat-option value="HIGH"><span class="priority-dot high"></span>{{ isAr() ? 'عالٍ' : 'High' }}</mat-option>
                <mat-option value="MEDIUM"><span class="priority-dot medium"></span>{{ isAr() ? 'متوسط' : 'Medium' }}</mat-option>
                <mat-option value="LOW"><span class="priority-dot low"></span>{{ isAr() ? 'منخفض' : 'Low' }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ isAr() ? 'التصنيف' : 'Category' }}</mat-label>
              <mat-select formControlName="categoryId">
                <mat-option *ngFor="let cat of categories()" [value]="cat.id">
                  {{ isAr() ? cat.nameAr : cat.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>{{ 'TASKS.ASSIGNED_TO' | translate }}</mat-label>
              <mat-select formControlName="assignedToId" required>
                <mat-option *ngFor="let u of users()" [value]="u.id">
                  {{ isAr() ? u.fullNameAr : u.fullName }} ({{ u.employeeCode }})
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="form-row-2">
            <mat-form-field appearance="outline">
              <mat-label>{{ isAr() ? 'تاريخ البدء' : 'Start Date' }}</mat-label>
              <input matInput [matDatepicker]="startPicker" formControlName="startDate">
              <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
              <mat-datepicker #startPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'TASKS.DUE_DATE' | translate }}</mat-label>
              <input matInput [matDatepicker]="duePicker" formControlName="dueDate">
              <mat-datepicker-toggle matSuffix [for]="duePicker"></mat-datepicker-toggle>
              <mat-datepicker #duePicker></mat-datepicker>
            </mat-form-field>
          </div>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-stroked-button (click)="close()">{{ 'COMMON.CANCEL' | translate }}</button>
        <button mat-raised-button color="primary" (click)="submit()" [disabled]="form.invalid || saving()">
          <mat-spinner *ngIf="saving()" diameter="18"></mat-spinner>
          <mat-icon *ngIf="!saving()">send</mat-icon>
          {{ isAr() ? 'إسناد المهمة' : 'Assign Task' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-wrapper { min-width: 560px; }
    .dialog-title {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 20px 24px 0; margin: 0;
      .dialog-title-left { display: flex; gap: 12px; align-items: flex-start; }
      .title-icon {
        width: 44px; height: 44px; border-radius: 12px;
        background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
        display: flex; align-items: center; justify-content: center;
        mat-icon { color: white; }
      }
      h2 { font-size: 18px; font-weight: 700; }
      p  { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    }

    .task-form { display: flex; flex-direction: column; gap: 0; padding: 16px 0; }
    .form-row { }
    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .priority-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50; margin-inline-end: 6px;
      &.urgent { background: #dc2626; } &.high { background: #ea580c; }
      &.medium { background: #2563eb; } &.low { background: #16a34a; }
    }

    @media (max-width: 600px) {
      .dialog-wrapper { min-width: 320px; }
      .form-row-2 { grid-template-columns: 1fr; }
    }
  `],
})
export class TaskFormDialogComponent implements OnInit {
  form: FormGroup;
  users = signal<any[]>([]);
  categories = signal<any[]>([]);
  saving = signal(false);
  isAr = () => this.langService.getCurrentLang() === 'ar';

  constructor(
    private fb: FormBuilder,
    private taskService: TaskService,
    private userService: UserService,
    private langService: LangService,
    private dialogRef: MatDialogRef<TaskFormDialogComponent>,
    private snack: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.form = fb.group({
      title: ['', Validators.required],
      titleAr: [''],
      description: [''],
      categoryId: [null],
      priority: ['MEDIUM', Validators.required],
      assignedToId: [null, Validators.required],
      startDate: [null],
      dueDate: [null],
    });
  }

  ngOnInit() {
    this.userService.getAssignable().subscribe(res => { if (res.success) this.users.set(res.data); });
    this.taskService.getCategories().subscribe(res => { if (res.success) this.categories.set(res.data); });

    if (this.data?.template) {
      const t = this.data.template;
      let dueDate = null;
      if (t.defaultDuration) {
        const d = new Date();
        d.setDate(d.getDate() + t.defaultDuration);
        dueDate = d;
      }
      this.form.patchValue({
        title: t.name,
        titleAr: t.nameAr,
        description: t.description,
        priority: t.priority,
        categoryId: null, // Templates don't currently have categoryId in frontend schema, but could in future
        startDate: new Date(),
        dueDate: dueDate
      });
    }
  }

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const val = this.form.value;
    const payload: any = {
      ...val,
      startDate: val.startDate?.toISOString(),
      dueDate: val.dueDate?.toISOString(),
    };
    if (this.data?.template?.id) {
      payload.templateId = this.data.template.id;
    }

    this.taskService.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open(this.isAr() ? 'تم إنشاء المهمة' : 'Task created!', '✓', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.saving.set(false);
        this.snack.open(err.error?.message || 'Error', 'X', { duration: 4000 });
      },
    });
  }

  close() { this.dialogRef.close(false); }
}
