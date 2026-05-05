import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../core/services/user.service';
import { LangService } from '../../core/services/lang.service';

@Component({
  selector: 'app-org-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MatTooltipModule, TranslateModule],
  template: `
    <div class="page-container fade-in">
      <div class="page-header">
        <div class="page-title">
          <h1>{{ 'ORG_CHART.TITLE' | translate }}</h1>
          <p>{{ isAr() ? 'الهيكل الهرمي للمؤسسة' : 'Organizational hierarchy' }}</p>
        </div>
        <mat-form-field appearance="outline" style="width:250px">
          <mat-label>{{ 'ORG_CHART.SEARCH' | translate }}</mat-label>
          <input matInput [(ngModel)]="search" (ngModelChange)="applySearch()" >
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </div>

      <div *ngIf="loading()" class="loading-center"><mat-spinner diameter="40"></mat-spinner></div>

      <div *ngIf="!loading()" class="org-tree">
        <ng-container *ngTemplateOutlet="nodeTemplate; context: { nodes: filteredTree(), level: 0 }"></ng-container>
      </div>

      <ng-template #nodeTemplate let-nodes="nodes" let-level="level">
        <div class="tree-level" [class.root-level]="level === 0">
          <div class="tree-node" *ngFor="let node of nodes">
            <div class="employee-card tf-card--interactive" [routerLink]="['/users', node.id]" [matTooltip]="node.employeeCode">
              <div class="emp-avatar">
                <img *ngIf="node.profilePhoto" [src]="node.profilePhoto" [alt]="node.fullName">
                <span *ngIf="!node.profilePhoto">{{ getInitial(isAr() ? node.fullNameAr : node.fullName) }}</span>
              </div>
              <div class="emp-info">
                <div class="emp-name">{{ isAr() ? node.fullNameAr : node.fullName }}</div>
                <div class="emp-code">{{ node.employeeCode }}</div>
                <div class="emp-role">{{ isAr() ? node.role?.nameAr : node.role?.name }}</div>
                <div class="emp-dept" *ngIf="node.department">{{ isAr() ? node.department?.nameAr : node.department?.name }}</div>
              </div>
              <div class="child-count" *ngIf="node.children?.length">
                <mat-icon>group</mat-icon> {{ node.children.length }}
              </div>
            </div>
            <div class="children-connector" *ngIf="node.children?.length">
              <ng-container *ngTemplateOutlet="nodeTemplate; context: { nodes: node.children, level: level + 1 }"></ng-container>
            </div>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .org-tree { overflow-x: auto; padding-bottom: 24px; }

    .tree-level {
      display: flex; flex-wrap: wrap; gap: 20px;
      padding-inline-start: 40px;
      &.root-level { padding-inline-start: 0; }
    }

    .tree-node { display: flex; flex-direction: column; align-items: flex-start; }

    .employee-card {
      background: var(--bg-card); border-radius: var(--radius-md);
      border: 1px solid var(--border-color);
      padding: 14px 16px; min-width: 180px; max-width: 220px;
      cursor: pointer; transition: all var(--transition);
      display: flex; align-items: flex-start; gap: 10px;
      box-shadow: var(--shadow-sm);

      &:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--color-primary-light); }
    }

    .emp-avatar {
      width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
      color: white; display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 700; overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }

    .emp-info { flex: 1; min-width: 0; }
    .emp-name { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .emp-code { font-size: 10px; color: var(--text-muted); font-family: monospace; }
    .emp-role { font-size: 11px; color: var(--color-primary-light); font-weight: 600; margin-top: 2px; }
    .emp-dept { font-size: 11px; color: var(--text-muted); }

    .child-count {
      display: flex; align-items: center; gap: 2px;
      font-size: 11px; color: var(--text-muted); font-weight: 700;
      mat-icon { font-size: 14px; }
    }

    .children-connector {
      margin-top: 16px;
      padding-inline-start: 20px;
      border-inline-start: 2px solid var(--border-color);
      position: relative;
      &::before {
        content: ''; position: absolute;
        top: -16px; inset-inline-start: 0; width: 20px; height: 16px;
        border-bottom: 2px solid var(--border-color);
      }
    }

    .loading-center { display: flex; justify-content: center; padding: 80px; }
  `],
})
export class OrgChartComponent implements OnInit {
  tree = signal<any[]>([]);
  filteredTree = signal<any[]>([]);
  loading = signal(true);
  search = '';
  isAr = () => this.langService.getCurrentLang() === 'ar';

  constructor(private userService: UserService, private langService: LangService) {}

  ngOnInit() {
    this.userService.getOrgTree().subscribe({
      next: (res) => { this.loading.set(false); if (res.success) { this.tree.set(res.data); this.filteredTree.set(res.data); } },
      error: () => this.loading.set(false),
    });
  }

  applySearch() {
    if (!this.search.trim()) { this.filteredTree.set(this.tree()); return; }
    // Simple flat search - filter to matching nodes
    this.filteredTree.set(this.filterTree(this.tree(), this.search.toLowerCase()));
  }

  filterTree(nodes: any[], s: string): any[] {
    return nodes.filter(n =>
      n.fullName?.toLowerCase().includes(s) ||
      n.fullNameAr?.toLowerCase().includes(s) ||
      n.employeeCode?.toLowerCase().includes(s)
    );
  }

  getInitial(name?: string): string { return name ? name.charAt(0).toUpperCase() : '?'; }
}
