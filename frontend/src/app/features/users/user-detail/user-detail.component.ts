import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { LangService } from '../../../core/services/lang.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, TranslateModule],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div class="page-title">
          <button mat-icon-button routerLink="/users" class="back-btn">
            <mat-icon>{{ isAr() ? 'arrow_forward' : 'arrow_back' }}</mat-icon>
          </button>
          <h1>{{ isNew() ? (isAr() ? 'إضافة موظف جديد' : 'Add New Employee') : (isAr() ? 'تعديل بيانات الموظف' : 'Edit Employee') }}</h1>
        </div>
        <div class="page-actions">
          <button mat-button color="warn" *ngIf="!isNew() && authService.hasRoleLevel(1)" (click)="deleteUser()">
            <mat-icon>delete</mat-icon>
            {{ isAr() ? 'حذف' : 'Delete' }}
          </button>
          <button mat-button routerLink="/users">{{ 'COMMON.CANCEL' | translate }}</button>
          <button mat-flat-button color="primary" class="tf-btn-primary" (click)="saveUser()" [disabled]="saving()">
            <mat-icon>{{ saving() ? 'hourglass_empty' : 'save' }}</mat-icon>
            {{ 'COMMON.SAVE' | translate }}
          </button>
        </div>
      </div>

      <div class="tf-card premium-glass" style="max-width: 800px; margin: 0 auto; padding: 32px;">
        <div class="form-grid">
          
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ isAr() ? 'الاسم باللغة الإنجليزية' : 'Full Name (English)' }}</mat-label>
            <input matInput [(ngModel)]="user.fullName" placeholder="e.g. Ahmed Mansour" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ isAr() ? 'الاسم باللغة العربية' : 'Full Name (Arabic)' }}</mat-label>
            <input matInput [(ngModel)]="user.fullNameAr" placeholder="مثال: أحمد منصور" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ isAr() ? 'كود الموظف (يُنشأ تلقائياً إن تُرك فارغاً)' : 'Employee Code (Auto if empty)' }}</mat-label>
            <input matInput [(ngModel)]="user.employeeCode" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'AUTH.USERNAME' | translate }}</mat-label>
            <input matInput [(ngModel)]="user.username" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ isAr() ? 'البريد الإلكتروني' : 'Email' }}</mat-label>
            <input matInput type="email" [(ngModel)]="user.email" />
          </mat-form-field>

          <mat-form-field appearance="outline" *ngIf="isNew()">
            <mat-label>{{ 'AUTH.PASSWORD' | translate }}</mat-label>
            <input matInput type="password" [(ngModel)]="user.password" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ isAr() ? 'الصلاحية (الدور)' : 'Role' }}</mat-label>
            <mat-select [(ngModel)]="user.roleId">
              <mat-option *ngFor="let r of roles" [value]="r.id">{{ isAr() ? r.nameAr : r.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ isAr() ? 'القسم' : 'Department' }}</mat-label>
            <mat-select [(ngModel)]="user.departmentId">
              <mat-option *ngFor="let d of departments()" [value]="d.id">{{ isAr() ? d.nameAr : d.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ isAr() ? 'المدير المباشر (يتبع مَن في الهيكل؟)' : 'Direct Manager' }}</mat-label>
            <mat-select [(ngModel)]="user.managerId">
              <mat-option [value]="null">{{ isAr() ? 'بدون مدير (مدير عام)' : 'No Manager (Top Level)' }}</mat-option>
              <mat-option *ngFor="let m of potentialManagers()" [value]="m.id">
                {{ isAr() ? m.fullNameAr : m.fullName }} ({{ m.employeeCode }})
              </mat-option>
            </mat-select>
          </mat-form-field>

          <div class="full-width" style="margin-top: 16px;">
            <mat-slide-toggle [(ngModel)]="user.isActive" color="primary">
              {{ user.isActive ? ('USERS.ACTIVE' | translate) : ('USERS.INACTIVE' | translate) }}
            </mat-slide-toggle>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .premium-glass {
      background: rgba(var(--bg-card-rgb), 0.7);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(var(--border-rgb), 0.5);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.05);
    }
    .back-btn { margin-inline-end: 12px; background: rgba(var(--text-main-rgb), 0.05); }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .full-width { grid-column: 1 / -1; }
    @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
  `]
})
export class UserDetailComponent implements OnInit {
  isNew = signal(true);
  saving = signal(false);
  userId: string | null = null;
  departments = signal<any[]>([]);
  potentialManagers = signal<any[]>([]);

  user: any = {
    employeeCode: '', fullName: '', fullNameAr: '', username: '', email: '', password: '', roleId: 5, departmentId: null, managerId: null, isActive: true
  };

  roles = [
    { id: 1, name: 'Super Admin', nameAr: 'مشرف عام' },
    { id: 2, name: 'Admin', nameAr: 'مدير النظام' },
    { id: 3, name: 'Manager', nameAr: 'مدير' },
    { id: 4, name: 'Supervisor', nameAr: 'مشرف' },
    { id: 5, name: 'Employee', nameAr: 'موظف' }
  ];

  isAr = () => this.langService.getCurrentLang() === 'ar';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private langService: LangService,
    public authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.userId = this.route.snapshot.paramMap.get('id');
    if (this.userId && this.userId !== 'new') {
      this.isNew.set(false);
      this.loadUser();
    }
    this.loadDepartments();
    this.loadManagers();
  }

  loadDepartments() {
    this.http.get<any>(`${environment.apiUrl}/departments`).subscribe(res => {
      if (res.success) this.departments.set(res.data);
    });
  }

  loadManagers() {
    this.http.get<any>(`${environment.apiUrl}/users`).subscribe(res => {
      if (res.success) {
        // Exclude the user themselves from being their own manager
        const managers = res.data.filter((u: any) => String(u.id) !== this.userId);
        this.potentialManagers.set(managers);
      }
    });
  }

  loadUser() {
    this.http.get<any>(`${environment.apiUrl}/users/${this.userId}`).subscribe(res => {
      if (res.success) {
        this.user = res.data;
      }
    });
  }

  saveUser() {
    this.saving.set(true);
    
    // Create a copy to manipulate
    const payload: any = { 
      fullName: this.user.fullName,
      fullNameAr: this.user.fullNameAr,
      employeeCode: this.user.employeeCode,
      username: this.user.username,
      email: this.user.email,
      roleId: this.user.roleId,
      departmentId: this.user.departmentId,
      managerId: this.user.managerId,
      isActive: this.user.isActive
    };
    
    if (!payload.employeeCode) delete payload.employeeCode;
    if (this.isNew() && this.user.password) payload.password = this.user.password;
    
    const req = this.isNew() 
      ? this.http.post<any>(`${environment.apiUrl}/users`, payload)
      : this.http.put<any>(`${environment.apiUrl}/users/${this.userId}`, payload);

    req.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.snackBar.open(this.isAr() ? 'تم الحفظ بنجاح' : 'Saved successfully', 'OK', { duration: 3000 });
          this.router.navigate(['/users']);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.snackBar.open(err.error?.message || 'Error occurred', 'OK', { duration: 3000 });
      }
    });
  }

  deleteUser() {
    if (confirm(this.isAr() ? 'هل أنت متأكد من حذف هذا الموظف؟' : 'Are you sure you want to delete this employee?')) {
      this.http.delete<any>(`${environment.apiUrl}/users/${this.userId}`).subscribe({
        next: (res) => {
          if (res.success) {
            this.snackBar.open(this.isAr() ? 'تم الحذف بنجاح' : 'Deleted successfully', 'OK', { duration: 3000 });
            this.router.navigate(['/users']);
          }
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Error occurred', 'OK', { duration: 3000 });
        }
      });
    }
  }
}
