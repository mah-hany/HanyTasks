import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { LangService } from '../../core/services/lang.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, TranslateModule],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div class="page-title">
          <h1>{{ 'NAV.PROFILE' | translate }}</h1>
        </div>
      </div>

      <div class="profile-layout">
        <!-- Profile Card -->
        <div class="tf-card profile-card">
          <div class="profile-avatar-area">
            <div class="profile-big-avatar">
              <img *ngIf="user()?.profilePhoto" [src]="user()?.profilePhoto" [alt]="user()?.fullName">
              <span *ngIf="!user()?.profilePhoto">{{ getInitial() }}</span>
            </div>
            <div class="profile-names">
              <h2>{{ isAr() ? user()?.fullNameAr : user()?.fullName }}</h2>
              <p>{{ user()?.employeeCode }}</p>
            </div>
          </div>
          <div class="profile-meta">
            <div class="meta-item">
              <mat-icon>badge</mat-icon>
              <span>{{ isAr() ? user()?.role?.nameAr : user()?.role?.name }}</span>
            </div>
            <div class="meta-item" *ngIf="user()?.department">
              <mat-icon>business</mat-icon>
              <span>{{ isAr() ? user()?.department?.nameAr : user()?.department?.name }}</span>
            </div>
            <div class="meta-item">
              <mat-icon>email</mat-icon>
              <span>{{ user()?.email }}</span>
            </div>
          </div>
        </div>

        <!-- Change Password -->
        <div class="tf-card change-pass-card">
          <h3 style="margin-bottom:20px">{{ 'AUTH.CHANGE_PASSWORD' | translate }}</h3>
          <form [formGroup]="passForm" (ngSubmit)="changePass()">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>{{ 'AUTH.CURRENT_PASSWORD' | translate }}</mat-label>
              <input matInput type="password" formControlName="oldPassword">
              <mat-icon matSuffix>lock</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>{{ 'AUTH.NEW_PASSWORD' | translate }}</mat-label>
              <input matInput type="password" formControlName="newPassword">
              <mat-hint>8+ characters</mat-hint>
            </mat-form-field>
            <button mat-raised-button color="primary" type="submit" [disabled]="passForm.invalid || saving()">
              <mat-spinner *ngIf="saving()" diameter="18"></mat-spinner>
              {{ 'COMMON.SAVE' | translate }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-layout { display: grid; grid-template-columns: 320px 1fr; gap: 20px; @media (max-width:768px) { grid-template-columns: 1fr; } }
    .profile-card { padding: 24px; }
    .profile-avatar-area { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 20px; }
    .profile-big-avatar {
      width: 90px; height: 90px; border-radius: 50%;
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
      color: white; display: flex; align-items: center; justify-content: center;
      font-size: 36px; font-weight: 700; margin-bottom: 12px; overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .profile-names h2 { font-size: 18px; font-weight: 800; } .profile-names p { font-size: 12px; color: var(--text-muted); }
    .profile-meta { display: flex; flex-direction: column; gap: 12px; }
    .meta-item { display: flex; align-items: center; gap: 8px; font-size: 13px; mat-icon { color: var(--color-primary-light); font-size: 18px; } }
    .change-pass-card { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
    form { display: flex; flex-direction: column; gap: 12px; }
  `],
})
export class ProfileComponent implements OnInit {
  passForm: FormGroup;
  saving = signal(false);
  user = () => this.authService.currentUser();
  isAr = () => this.langService.getCurrentLang() === 'ar';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private langService: LangService,
    private snack: MatSnackBar,
  ) {
    this.passForm = fb.group({
      oldPassword: [''],
      newPassword: [''],
    });
  }

  ngOnInit() { this.authService.getProfile().subscribe(); }

  getInitial(): string {
    const name = this.isAr() ? this.user()?.fullNameAr : this.user()?.fullName;
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  changePass() {
    this.saving.set(true);
    const { oldPassword, newPassword } = this.passForm.value;
    this.authService.changePassword(oldPassword, newPassword).subscribe({
      next: () => { this.saving.set(false); this.snack.open(this.isAr() ? 'تم تغيير كلمة المرور' : 'Password changed!', '✓', { duration: 3000 }); this.passForm.reset(); },
      error: (err) => { this.saving.set(false); this.snack.open(err.error?.message || 'Error', 'X'); },
    });
  }
}
