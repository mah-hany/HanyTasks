import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { LangService } from '../../../core/services/lang.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule, TranslateModule],
  template: `
    <div class="login-bg">
      <!-- Animated background blobs -->
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>

      <div class="login-container">
        <!-- Logo -->
        <div class="login-logo">
          <div class="logo-circle">
            <mat-icon>task_alt</mat-icon>
          </div>
          <h1>TaskFlow Pro</h1>
          <p>{{ 'APP_SUBTITLE' | translate }}</p>
        </div>

        <!-- Card -->
        <div class="login-card glass">
          <div class="card-header">
            <h2>{{ 'AUTH.LOGIN_TITLE' | translate }}</h2>
            <p>{{ 'AUTH.LOGIN_SUBTITLE' | translate }}</p>
          </div>

          <!-- Change Password prompt (first login) -->
          <div class="first-login-banner" *ngIf="showChangePassword()">
            <mat-icon>info</mat-icon>
            <span>{{ 'AUTH.FIRST_LOGIN_MSG' | translate }}</span>
          </div>

          <!-- Login Form -->
          <form *ngIf="!showChangePassword()" [formGroup]="loginForm" (ngSubmit)="onLogin()" class="login-form">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>{{ 'AUTH.USERNAME' | translate }}</mat-label>
              <input matInput formControlName="username" autocomplete="username" [placeholder]="'AUTH.USERNAME' | translate">
              <mat-icon matSuffix>person_outline</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-100">
              <mat-label>{{ 'AUTH.PASSWORD' | translate }}</mat-label>
              <input matInput [type]="hidePass() ? 'password' : 'text'" formControlName="password" autocomplete="current-password">
              <button type="button" mat-icon-button matSuffix (click)="hidePass.set(!hidePass())">
                <mat-icon>{{ hidePass() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>

            <button mat-raised-button color="primary" type="submit" class="login-btn w-100"
                    [disabled]="loginForm.invalid || loading()">
              <mat-spinner *ngIf="loading()" diameter="20" color="accent"></mat-spinner>
              <span *ngIf="!loading()">{{ 'AUTH.LOGIN_BTN' | translate }}</span>
              <span *ngIf="loading()">{{ 'AUTH.LOGGING_IN' | translate }}</span>
            </button>
          </form>

          <!-- Change Password Form -->
          <form *ngIf="showChangePassword()" [formGroup]="changePassForm" (ngSubmit)="onChangePassword()" class="login-form">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>{{ 'AUTH.CURRENT_PASSWORD' | translate }}</mat-label>
              <input matInput type="password" formControlName="oldPassword">
              <mat-icon matSuffix>lock_outline</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-100">
              <mat-label>{{ 'AUTH.NEW_PASSWORD' | translate }}</mat-label>
              <input matInput [type]="hidePass() ? 'password' : 'text'" formControlName="newPassword">
              <button type="button" mat-icon-button matSuffix (click)="hidePass.set(!hidePass())">
                <mat-icon>{{ hidePass() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-hint>8+ characters</mat-hint>
            </mat-form-field>

            <button mat-raised-button color="primary" type="submit" class="login-btn w-100"
                    [disabled]="changePassForm.invalid || loading()">
              <mat-spinner *ngIf="loading()" diameter="20"></mat-spinner>
              <span>{{ 'AUTH.CHANGE_PASSWORD' | translate }}</span>
            </button>
          </form>

          <!-- Error -->
          <div class="error-msg" *ngIf="errorMsg()">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMsg() }}</span>
          </div>
        </div>

        <!-- Lang toggle -->
        <button class="lang-toggle" (click)="toggleLang()">
          <mat-icon>language</mat-icon>
          {{ currentLang() === 'ar' ? 'English' : 'العربية' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .login-bg {
      min-height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1a2e4a 100%);
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden; padding: 24px;
    }

    .blob {
      position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.25;
      animation: blobFloat 8s ease-in-out infinite;
    }
    .blob-1 { width: 400px; height: 400px; background: #2e86ab; top: -10%; left: -10%; }
    .blob-2 { width: 300px; height: 300px; background: #f18f01; bottom: -5%; right: -5%; animation-delay: -3s; }
    .blob-3 { width: 250px; height: 250px; background: #1e3a5f; top: 40%; left: 60%; animation-delay: -6s; }

    @keyframes blobFloat {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33%       { transform: translate(20px, -20px) scale(1.05); }
      66%       { transform: translate(-15px, 15px) scale(0.95); }
    }

    .login-container {
      position: relative; z-index: 10;
      display: flex; flex-direction: column; align-items: center; gap: 24px;
      width: 100%; max-width: 420px;
    }

    .login-logo {
      text-align: center; color: white;
      .logo-circle {
        width: 72px; height: 72px; border-radius: 20px;
        background: linear-gradient(135deg, #f18f01, #e87c00);
        display: flex; align-items: center; justify-content: center;
        margin: 0 auto 16px;
        box-shadow: 0 8px 32px rgba(241,143,1,0.4);
        animation: pulse 2.5s ease-in-out infinite;
        mat-icon { font-size: 36px; color: white; }
      }
      h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
      p  { font-size: 14px; opacity: 0.7; }
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 8px 32px rgba(241,143,1,0.4); }
      50%       { transform: scale(1.04); box-shadow: 0 12px 40px rgba(241,143,1,0.6); }
    }

    .login-card {
      width: 100%;
      background: rgba(255,255,255,0.08) !important;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.15) !important;
      border-radius: 24px !important;
      padding: 32px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.3);
      animation: fadeIn 0.5s ease;
    }

    .card-header {
      text-align: center; margin-bottom: 28px; color: white;
      h2 { font-size: 22px; font-weight: 700; }
      p  { font-size: 14px; opacity: 0.6; margin-top: 4px; }
    }

    .first-login-banner {
      display: flex; align-items: center; gap: 8px;
      background: rgba(241,143,1,0.15); border: 1px solid rgba(241,143,1,0.3);
      border-radius: 10px; padding: 10px 14px; margin-bottom: 20px;
      color: #f59e0b; font-size: 13px;
      mat-icon { font-size: 18px; }
    }

    .login-form {
      display: flex; flex-direction: column; gap: 16px;

      ::ng-deep .mat-mdc-form-field {
        .mat-mdc-text-field-wrapper { background: rgba(255,255,255,0.06) !important; }
        .mat-mdc-floating-label, input { color: white !important; }
        .mat-mdc-notch-piece { border-color: rgba(255,255,255,0.2) !important; }
        .mat-mdc-form-field-focus-overlay { background: rgba(255,255,255,0.05); }
        .mat-icon { color: rgba(255,255,255,0.5); }
        &.mat-focused .mat-mdc-notch-piece { border-color: #f18f01 !important; }
      }
    }

    .login-btn {
      height: 50px; font-size: 16px; font-weight: 700; border-radius: 12px !important;
      background: linear-gradient(135deg, #f18f01, #e07800) !important;
      box-shadow: 0 4px 20px rgba(241,143,1,0.4) !important;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: all 0.3s !important;
      &:hover:not([disabled]) {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(241,143,1,0.5) !important;
      }
    }

    .error-msg {
      display: flex; align-items: center; gap: 8px;
      background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.3);
      border-radius: 10px; padding: 10px 14px; margin-top: 12px;
      color: #fca5a5; font-size: 13px;
      mat-icon { font-size: 18px; }
    }

    .lang-toggle {
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
      color: white; border-radius: 20px; padding: 8px 16px;
      cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 13px;
      display: flex; align-items: center; gap: 6px;
      transition: all 0.25s;
      &:hover { background: rgba(255,255,255,0.2); }
    }

    @media (max-width: 480px) {
      .login-card { padding: 24px 20px; border-radius: 20px !important; }
    }
  `],
})
export class LoginComponent {
  loginForm: FormGroup;
  changePassForm: FormGroup;
  loading = signal(false);
  hidePass = signal(true);
  errorMsg = signal<string>('');
  showChangePassword = signal(false);
  currentLang = signal<string>('ar');

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private langService: LangService,
    private translate: TranslateService,
    private router: Router,
    private snack: MatSnackBar,
  ) {
    this.currentLang.set(langService.getCurrentLang());
    this.loginForm = fb.group({
      username: ['', [Validators.required, Validators.minLength(2)]],
      password: ['', [Validators.required, Validators.minLength(4)]],
    });
    this.changePassForm = fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  onLogin() {
    if (this.loginForm.invalid) return;
    this.loading.set(true);
    this.errorMsg.set('');
    const { username, password } = this.loginForm.value;

    this.authService.login(username, password).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.data.isFirstLogin) {
          // Store temp credentials for password change
          this.changePassForm.patchValue({ oldPassword: password });
          this.showChangePassword.set(true);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err.error?.message || 'Login failed');
      },
    });
  }

  onChangePassword() {
    if (this.changePassForm.invalid) return;
    this.loading.set(true);
    const { oldPassword, newPassword } = this.changePassForm.value;

    this.authService.changePassword(oldPassword, newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.snack.open('Password changed successfully!', '✓', { duration: 3000 });
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err.error?.message || 'Failed to change password');
      },
    });
  }

  toggleLang() {
    const newLang = this.currentLang() === 'ar' ? 'en' : 'ar';
    this.currentLang.set(newLang);
    this.langService.setLang(newLang as 'ar' | 'en');
    this.translate.use(newLang);
  }
}
