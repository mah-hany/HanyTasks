import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { LangService } from '../../../core/services/lang.service';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule, MatMenuModule, MatDialogModule, TranslateModule],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div class="page-title">
          <h1>{{ 'USERS.TITLE' | translate }}</h1>
          <p>{{ filteredUsers().length }} {{ isAr() ? 'موظف' : 'employees' }}</p>
        </div>
        <button mat-raised-button color="primary" *ngIf="authService.hasRoleLevel(2)" routerLink="/users/new">
          <mat-icon>person_add</mat-icon>
          {{ 'USERS.NEW_USER' | translate }}
        </button>
      </div>

      <!-- Filters -->
      <div class="filters-bar" style="margin-bottom:20px">
        <mat-form-field appearance="outline" style="flex:1;min-width:200px">
          <mat-label>{{ 'COMMON.SEARCH' | translate }}</mat-label>
          <input matInput [(ngModel)]="search" (ngModelChange)="applyFilters()">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:160px">
          <mat-label>{{ isAr() ? 'الحالة' : 'Status' }}</mat-label>
          <mat-select [(ngModel)]="filterActive" (ngModelChange)="applyFilters()">
            <mat-option value="">{{ isAr() ? 'الكل' : 'All' }}</mat-option>
            <mat-option value="true">{{ 'USERS.ACTIVE' | translate }}</mat-option>
            <mat-option value="false">{{ 'USERS.INACTIVE' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div *ngIf="loading()" class="loading-center"><mat-spinner diameter="40"></mat-spinner></div>

      <div *ngIf="!loading()" class="users-grid">
        <div class="user-card tf-card" *ngFor="let user of filteredUsers()" [routerLink]="['/users', user.id]">
          <div class="user-card-top">
            <div class="user-big-avatar" [style.background]="user.isActive ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))' : '#94a3b8'">
              <img *ngIf="user.profilePhoto" [src]="user.profilePhoto" [alt]="user.fullName">
              <span *ngIf="!user.profilePhoto">{{ getInitial(isAr() ? user.fullNameAr : user.fullName) }}</span>
            </div>
            <span class="active-badge" [class.inactive]="!user.isActive">
              {{ user.isActive ? ('USERS.ACTIVE' | translate) : ('USERS.INACTIVE' | translate) }}
            </span>
          </div>
          <div class="user-card-body">
            <div class="user-full-name">{{ isAr() ? user.fullNameAr : user.fullName }}</div>
            <div class="user-emp-code">{{ user.employeeCode }}</div>
            <div class="user-role-dept">
              <span class="role-tag">{{ isAr() ? user.role?.nameAr : user.role?.name }}</span>
              <span *ngIf="user.department"> · {{ isAr() ? user.department?.nameAr : user.department?.name }}</span>
            </div>
            <div class="user-contact">
              <mat-icon inline>email</mat-icon> {{ user.email }}
            </div>
          </div>
        </div>

        <div *ngIf="!filteredUsers().length" class="empty-state" style="grid-column:1/-1">
          <mat-icon>people_outline</mat-icon>
          <p>{{ 'COMMON.NO_DATA' | translate }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .filters-bar { display: flex; gap: 12px; flex-wrap: wrap; }

    .users-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
    }

    .user-card {
      padding: 0; overflow: hidden; cursor: pointer;
      transition: all var(--transition);
      &:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
    }

    .user-card-top {
      padding: 20px 20px 12px;
      background: linear-gradient(135deg, #f8fafc, #f0f4f8);
      display: flex; justify-content: space-between; align-items: flex-start;
      position: relative;
    }

    .user-big-avatar {
      width: 60px; height: 60px; border-radius: 16px;
      color: white; display: flex; align-items: center; justify-content: center;
      font-size: 24px; font-weight: 700; overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      img { width: 100%; height: 100%; object-fit: cover; }
    }

    .active-badge {
      font-size: 11px; font-weight: 700; padding: 3px 8px;
      border-radius: 20px; background: #dcfce7; color: #16a34a;
      &.inactive { background: #fee2e2; color: #dc2626; }
    }

    .user-card-body { padding: 12px 20px 20px; }
    .user-full-name { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
    .user-emp-code { font-size: 11px; color: var(--text-muted); font-family: monospace; margin-bottom: 8px; }
    .role-tag { font-size: 11px; font-weight: 700; color: var(--color-primary); }
    .user-role-dept { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
    .user-contact { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; mat-icon { font-size: 13px; } }

    .loading-center { display: flex; justify-content: center; padding: 80px; }
    .empty-state { text-align: center; padding: 60px; color: var(--text-muted); mat-icon { font-size: 56px; opacity: 0.2; } p { margin-top: 8px; } }
  `],
})
export class UsersListComponent implements OnInit {
  users = signal<any[]>([]);
  filteredUsers = signal<any[]>([]);
  loading = signal(true);
  search = '';
  filterActive = '';
  isAr = () => this.langService.getCurrentLang() === 'ar';

  constructor(
    public authService: AuthService,
    private userService: UserService,
    private langService: LangService,
  ) {}

  ngOnInit() {
    this.userService.getAll().subscribe({
      next: (res) => { this.loading.set(false); if (res.success) { this.users.set(res.data); this.filteredUsers.set(res.data); } },
      error: () => this.loading.set(false),
    });
  }

  applyFilters() {
    let list = this.users();
    if (this.search) {
      const s = this.search.toLowerCase();
      list = list.filter(u => u.fullName?.toLowerCase().includes(s) || u.fullNameAr?.toLowerCase().includes(s) || u.employeeCode?.toLowerCase().includes(s));
    }
    if (this.filterActive !== '') list = list.filter(u => String(u.isActive) === this.filterActive);
    this.filteredUsers.set(list);
  }

  getInitial(name?: string): string { return name ? name.charAt(0).toUpperCase() : '?'; }
}
