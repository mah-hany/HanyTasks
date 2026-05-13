import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { ExtractService } from '../../core/services/extract.service';
import { AuthService } from '../../core/services/auth.service';
import { LangService } from '../../core/services/lang.service';
import { TaskService } from '../../core/services/task.service';
import { ReturnCommentDialogComponent } from './return-comment-dialog.component';

@Component({
  selector: 'app-extracts-page',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, MatTableModule, MatPaginatorModule,
    MatSortModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatDialogModule, MatProgressSpinnerModule, MatTooltipModule,
    MatDatepickerModule, MatNativeDateModule, MatChipsModule],
  template: `
<div class="page-container fade-in">
  <div class="page-header">
    <div class="page-title">
      <h1>{{ isAr() ? '📄 المستخلصات' : '📄 Extracts' }}</h1>
      <p>{{ isAr() ? 'إدارة مستخلصات المقاولين' : 'Manage contractor extracts' }}</p>
    </div>
    <button mat-raised-button color="primary" (click)="openCreate()" *ngIf="canCreate()">
      <mat-icon>add</mat-icon> {{ isAr() ? 'مستخلص جديد' : 'New Extract' }}
    </button>
  </div>

  <!-- Summary chips -->
  <div class="summary-row">
    <div class="sum-chip gray"   (click)="setFilter('')"             [class.active]="filterStatus===''">
      <mat-icon>receipt_long</mat-icon> {{ isAr() ? 'الكل' : 'All' }} <strong>{{summary().total}}</strong>
    </div>
    <div class="sum-chip amber"  (click)="setFilter('RECEIVED')"     [class.active]="filterStatus==='RECEIVED'">
      <mat-icon>inbox</mat-icon> {{ isAr() ? 'استلام' : 'Received' }} <strong>{{summary().received}}</strong>
    </div>
    <div class="sum-chip blue"   (click)="setFilter('UNDER_REVIEW')" [class.active]="filterStatus==='UNDER_REVIEW'">
      <mat-icon>manage_search</mat-icon> {{ isAr() ? 'مراجعة' : 'Under Review' }} <strong>{{summary().underReview}}</strong>
    </div>
    <div class="sum-chip red"    (click)="setFilter('RETURNED')"     [class.active]="filterStatus==='RETURNED'">
      <mat-icon>assignment_return</mat-icon> {{ isAr() ? 'مُرجَع' : 'Returned' }} <strong>{{summary().returned}}</strong>
    </div>
    <div class="sum-chip green"  (click)="setFilter('POSTED')"       [class.active]="filterStatus==='POSTED'">
      <mat-icon>check_circle</mat-icon> {{ isAr() ? 'مُدرج' : 'Posted' }} <strong>{{summary().posted}}</strong>
    </div>
  </div>

  <!-- Financial Summary Banner -->
  <div class="financial-banner tf-card" *ngIf="financialSummary()">
    <div class="fin-title">
      <mat-icon>account_balance_wallet</mat-icon>
      {{ isAr() ? 'ملخص مالي' : 'Financial Summary' }}
    </div>
    <div class="fin-cards">
      <div class="fin-card amber">
        <span class="fin-label">{{ isAr() ? 'مستلم' : 'Received' }}</span>
        <span class="fin-amount">{{ formatAmount(financialSummary()?.byStatus?.[0]?.total) }}</span>
        <span class="fin-count">{{financialSummary()?.byStatus?.[0]?.count}} {{ isAr() ? 'مستخلص' : 'extracts' }}</span>
      </div>
      <div class="fin-card blue">
        <span class="fin-label">{{ isAr() ? 'مراجعة' : 'Under Review' }}</span>
        <span class="fin-amount">{{ formatAmount(financialSummary()?.byStatus?.[1]?.total) }}</span>
        <span class="fin-count">{{financialSummary()?.byStatus?.[1]?.count}} {{ isAr() ? 'مستخلص' : 'extracts' }}</span>
      </div>
      <div class="fin-card green">
        <span class="fin-label">{{ isAr() ? 'مُدرج' : 'Posted' }}</span>
        <span class="fin-amount">{{ formatAmount(financialSummary()?.byStatus?.[2]?.total) }}</span>
        <span class="fin-count">{{financialSummary()?.byStatus?.[2]?.count}} {{ isAr() ? 'مستخلص' : 'extracts' }}</span>
      </div>
      <div class="fin-card red">
        <span class="fin-label">{{ isAr() ? 'مُرجَع' : 'Returned' }}</span>
        <span class="fin-amount">{{ formatAmount(financialSummary()?.byStatus?.[3]?.total) }}</span>
        <span class="fin-count">{{financialSummary()?.byStatus?.[3]?.count}} {{ isAr() ? 'مستخلص' : 'extracts' }}</span>
      </div>
      <div class="fin-card grand">
        <span class="fin-label">{{ isAr() ? 'الإجمالي' : 'Grand Total' }}</span>
        <span class="fin-amount">{{ formatAmount(financialSummary()?.grandTotal) }}</span>
        <span class="fin-count">{{financialSummary()?.grandCount}} {{ isAr() ? 'مستخلص بمبالغ' : 'with amounts' }}</span>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="filter-card tf-card">
    <div class="filter-row">
      <mat-form-field appearance="outline">
        <mat-label>{{ isAr() ? 'المشروع' : 'Project' }}</mat-label>
        <mat-select [(ngModel)]="filterProject" (ngModelChange)="load()">
          <mat-option value="">{{ isAr() ? 'الكل' : 'All' }}</mat-option>
          <mat-option *ngFor="let p of projects()" [value]="p.id">{{p.name}}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ isAr() ? 'المقاول' : 'Contractor' }}</mat-label>
        <mat-select [(ngModel)]="filterContractor" (ngModelChange)="load()" (openedChange)="filterContractorQ=''">
          <div class="select-search-wrap">
            <mat-icon class="select-search-icon">search</mat-icon>
            <input class="select-search-input"
                   [placeholder]="isAr() ? 'ابحث...' : 'Search...'"
                   [(ngModel)]="filterContractorQ"
                   (keydown.space)="$event.stopPropagation()"
                   (click)="$event.stopPropagation()">
          </div>
          <mat-option value="">{{ isAr() ? 'الكل' : 'All' }}</mat-option>
          <mat-option *ngFor="let c of filteredContractors()" [value]="c.id">
            <span class="opt-code">{{c.code}}</span> {{c.name}}
          </mat-option>
          <mat-option *ngIf="filteredContractors().length === 0" disabled>
            <span style="color:var(--text-muted);font-size:12px">{{ isAr() ? 'لا نتائج' : 'No results' }}</span>
          </mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="search-field">
        <mat-label>{{ isAr() ? 'بحث...' : 'Search...' }}</mat-label>
        <input matInput [(ngModel)]="filterSearch" (ngModelChange)="load()">
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ isAr() ? 'من تاريخ' : 'Date From' }}</mat-label>
        <input matInput [matDatepicker]="dp1" [(ngModel)]="filterFrom" (ngModelChange)="load()">
        <mat-datepicker-toggle matSuffix [for]="dp1"></mat-datepicker-toggle>
        <mat-datepicker #dp1></mat-datepicker>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ isAr() ? 'إلى تاريخ' : 'Date To' }}</mat-label>
        <input matInput [matDatepicker]="dp2" [(ngModel)]="filterTo" (ngModelChange)="load()">
        <mat-datepicker-toggle matSuffix [for]="dp2"></mat-datepicker-toggle>
        <mat-datepicker #dp2></mat-datepicker>
      </mat-form-field>
    </div>
  </div>

  <!-- Table -->
  <div class="tf-card table-wrap">
    <div *ngIf="loading()" class="loading-center"><mat-spinner diameter="40"></mat-spinner></div>
    <table mat-table [dataSource]="ds" *ngIf="!loading()">
      <ng-container matColumnDef="extractNumber">
        <th mat-header-cell *matHeaderCellDef>{{ isAr() ? 'رقم المستخلص' : '#' }}</th>
        <td mat-cell *matCellDef="let r"><span class="num-badge">#{{r.extractNumber}}</span></td>
      </ng-container>
      <ng-container matColumnDef="contractor">
        <th mat-header-cell *matHeaderCellDef>{{ isAr() ? 'المقاول' : 'Contractor' }}</th>
        <td mat-cell *matCellDef="let r"><strong>{{r.contractor?.name}}</strong></td>
      </ng-container>
      <ng-container matColumnDef="project">
        <th mat-header-cell *matHeaderCellDef>{{ isAr() ? 'المشروع' : 'Project' }}</th>
        <td mat-cell *matCellDef="let r">{{r.project?.name}}</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>{{ isAr() ? 'الحالة' : 'Status' }}</th>
        <td mat-cell *matCellDef="let r">
          <span class="status-badge" [class]="r.status.toLowerCase().replace('_','-')">
            {{statusLabel(r.status)}}
          </span>
        </td>
      </ng-container>
      <ng-container matColumnDef="task">
        <th mat-header-cell *matHeaderCellDef>{{ isAr() ? 'المهمة' : 'Task' }}</th>
        <td mat-cell *matCellDef="let r">
          <span *ngIf="r.task" class="code-badge">{{r.task?.taskCode}}</span>
          <span *ngIf="!r.task" class="text-muted">—</span>
        </td>
      </ng-container>
      <ng-container matColumnDef="amount">
        <th mat-header-cell *matHeaderCellDef>{{ isAr() ? 'المبلغ' : 'Amount' }}</th>
        <td mat-cell *matCellDef="let r">
          <span *ngIf="r.amount" class="amount-badge">{{r.amount | number:'1.0-0'}} <small>{{r.currency}}</small></span>
          <span *ngIf="!r.amount" class="text-muted">—</span>
        </td>
      </ng-container>
      <ng-container matColumnDef="receivedAt">
        <th mat-header-cell *matHeaderCellDef>{{ isAr() ? 'التاريخ' : 'Date' }}</th>
        <td mat-cell *matCellDef="let r">{{r.receivedAt | date:'dd/MM/yyyy'}}</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>{{ isAr() ? 'إجراءات' : 'Actions' }}</th>
        <td mat-cell *matCellDef="let r">
          <div class="actions-cell">
            <button mat-stroked-button color="primary" *ngIf="canTransition(r,'UNDER_REVIEW')" (click)="doTransition(r,'UNDER_REVIEW')">
              <mat-icon>rate_review</mat-icon> {{ isAr() ? 'مراجعة' : 'Review' }}
            </button>
            <button mat-stroked-button color="accent" *ngIf="canTransition(r,'POSTED')" (click)="doTransition(r,'POSTED')">
              <mat-icon>check_circle</mat-icon> {{ isAr() ? 'إدراج' : 'Post' }}
            </button>
            <button mat-stroked-button color="accent" *ngIf="canTransition(r,'UNDER_REVIEW') && r.status==='RETURNED'" (click)="doTransition(r,'UNDER_REVIEW')">
              <mat-icon>replay</mat-icon> {{ isAr() ? 'إعادة تقديم' : 'Resubmit' }}
            </button>
            <button mat-icon-button color="warn" *ngIf="canReturn(r)" (click)="openReturn(r)" [matTooltip]="isAr() ? 'إرجاع' : 'Return'">
              <mat-icon>assignment_return</mat-icon>
            </button>
            <button mat-icon-button *ngIf="canEdit(r)" (click)="openEdit(r); $event.stopPropagation()" [matTooltip]="isAr() ? 'تعديل' : 'Edit'" style="color:var(--primary)">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button color="warn" *ngIf="canDelete()" (click)="deleteItem(r.id, r.extractNumber)" [matTooltip]="isAr() ? 'حذف' : 'Delete'">
              <mat-icon>delete</mat-icon>
            </button>
            <button mat-icon-button color="primary" (click)="showQR(r)" [matTooltip]="isAr() ? 'رمز QR' : 'QR Code'">
              <mat-icon>qr_code_2</mat-icon>
            </button>
          </div>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let r; columns: cols;" (click)="toggleExpand(r)" class="data-row"
          [class.expanded]="expandedRow === r"></tr>
      <!-- Expanded detail row -->
      <ng-container matColumnDef="expandedDetail">
        <td mat-cell *matCellDef="let r" [attr.colspan]="cols.length">
          <div class="expand-panel" *ngIf="expandedRow === r && r.comments?.length">
            <div class="return-note" *ngFor="let c of r.comments">
              <mat-icon style="color:#dc2626">assignment_return</mat-icon>
              <div>
                <div class="note-header">
                  <span class="note-author">{{c.user?.fullName}}</span>
                  <span class="note-date">{{c.commentDate | date:'dd/MM/yyyy HH:mm'}}</span>
                  <span class="note-badge">{{ isAr() ? 'مُرجَع' : 'Returned' }}</span>
                </div>
                <p class="note-text">{{c.commentText}}</p>
              </div>
            </div>
          </div>
          <div class="expand-panel empty" *ngIf="expandedRow === r && !r.comments?.length">
            <mat-icon>info</mat-icon> {{ isAr() ? 'لا توجد ملاحظات إرجاع' : 'No return notes' }}
          </div>
        </td>
      </ng-container>
      <tr mat-row *matRowDef="let r; columns: ['expandedDetail']" class="detail-row"></tr>
    </table>
    <mat-paginator [pageSizeOptions]="[10,20,50]" pageSize="20" showFirstLastButtons></mat-paginator>
  </div>

  <!-- Create dialog (inline) -->
  <div class="form-overlay" *ngIf="showCreate()">
    <div class="form-backdrop" (click)="showCreate.set(false)"></div>
    <div class="form-drawer tf-card">
      <div class="form-header">
        <h3>{{ isAr() ? 'مستخلص جديد' : 'New Extract' }}</h3>
        <button mat-icon-button (click)="showCreate.set(false)"><mat-icon>close</mat-icon></button>
      </div>
      <div class="form-body">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>{{ isAr() ? 'رقم المستخلص' : 'Extract Number' }}</mat-label>
          <input matInput type="number" [(ngModel)]="newForm.extractNumber" min="1">
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>{{ isAr() ? 'المقاول' : 'Contractor' }}</mat-label>
          <mat-select [(ngModel)]="newForm.contractorId" (openedChange)="formContractorQ=''">
            <div class="select-search-wrap">
              <mat-icon class="select-search-icon">search</mat-icon>
              <input class="select-search-input"
                     [placeholder]="isAr() ? 'اكتب اسم أو كود المقاول...' : 'Search by name or code...'"
                     [(ngModel)]="formContractorQ"
                     (keydown.space)="$event.stopPropagation()"
                     (click)="$event.stopPropagation()">
            </div>
            <mat-option *ngFor="let c of filteredContractorsForm()" [value]="c.id">
              <span class="opt-code">{{c.code}}</span> {{c.name}}
            </mat-option>
            <mat-option *ngIf="filteredContractorsForm().length === 0" disabled>
              <span style="color:var(--text-muted);font-size:12px">{{ isAr() ? 'لا نتائج' : 'No results' }}</span>
            </mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>{{ isAr() ? 'المشروع' : 'Project' }}</mat-label>
          <mat-select [(ngModel)]="newForm.projectId">
            <mat-option *ngFor="let p of projects()" [value]="p.id">{{p.name}}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>{{ isAr() ? 'المهمة المرتبطة (اختياري)' : 'Linked Task (optional)' }}</mat-label>
          <mat-select [(ngModel)]="newForm.taskId" (openedChange)="formTaskQ=''">
            <div class="select-search-wrap">
              <mat-icon class="select-search-icon">search</mat-icon>
              <input class="select-search-input"
                     [placeholder]="isAr() ? 'ابحث بكود أو اسم المهمة...' : 'Search by code or title...'"
                     [(ngModel)]="formTaskQ"
                     (keydown.space)="$event.stopPropagation()"
                     (click)="$event.stopPropagation()">
            </div>
            <mat-option [value]="null">
              <mat-icon style="font-size:15px;vertical-align:middle;color:var(--text-muted)">link_off</mat-icon>
              {{ isAr() ? 'بدون ربط بمهمة' : 'No linked task' }}
            </mat-option>
            <mat-option *ngFor="let t of filteredTasksForm()" [value]="t.id">
              <span class="opt-code">{{t.taskCode}}</span>
              {{ isAr() && t.titleAr ? t.titleAr : t.title }}
            </mat-option>
            <mat-option *ngIf="filteredTasksForm().length === 0" disabled>
              <span style="color:var(--text-muted);font-size:12px">{{ isAr() ? 'لا نتائج' : 'No results' }}</span>
            </mat-option>
          </mat-select>
          <mat-icon matSuffix style="font-size:16px">link</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>{{ isAr() ? 'ملاحظات' : 'Notes' }}</mat-label>
          <textarea matInput [(ngModel)]="newForm.notes" rows="2"></textarea>
        </mat-form-field>
        <!-- حقول مالية -->
        <div class="amount-row">
          <mat-form-field appearance="outline" class="amount-field">
            <mat-label>{{ isAr() ? 'المبلغ (اختياري)' : 'Amount (optional)' }}</mat-label>
            <input matInput type="number" min="0" [(ngModel)]="newForm.amount" placeholder="0.00">
            <mat-icon matSuffix>payments</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline" class="currency-field">
            <mat-label>{{ isAr() ? 'العملة' : 'Currency' }}</mat-label>
            <mat-select [(ngModel)]="newForm.currency">
              <mat-option *ngFor="let cur of enabledCurrencies()" [value]="cur.code">
                {{cur.flag}} {{cur.code}}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>
      <div class="form-footer">
        <button mat-button (click)="showCreate.set(false)">{{ isAr() ? 'إلغاء' : 'Cancel' }}</button>
        <button mat-raised-button color="primary" (click)="submitCreate()"
          [disabled]="!newForm.extractNumber || !newForm.contractorId || !newForm.projectId || saving()">
          <mat-icon>save</mat-icon> {{ isAr() ? 'حفظ' : 'Save' }}
        </button>
      </div>
    </div>
  </div>

  <!-- ── Edit dialog (inline drawer) ──────────────────────── -->
  <div class="form-overlay" *ngIf="showEdit()">
    <div class="form-backdrop" (click)="showEdit.set(false)"></div>
    <div class="form-drawer tf-card">
      <div class="form-header">
        <h3>
          <mat-icon style="vertical-align:middle;margin-inline-end:6px;font-size:20px">edit</mat-icon>
          {{ isAr() ? 'تعديل المستخلص' : 'Edit Extract' }}
          <span class="edit-num-badge">#{{editForm.extractNumber}}</span>
        </h3>
        <button mat-icon-button (click)="showEdit.set(false)"><mat-icon>close</mat-icon></button>
      </div>

      <!-- Read-only info bar -->
      <div class="edit-info-bar">
        <span class="edit-info-item">
          <mat-icon>person</mat-icon> {{editForm.contractorName}}
        </span>
        <span class="edit-info-item">
          <mat-icon>business</mat-icon> {{editForm.projectName}}
        </span>
        <span class="edit-status-badge" [class]="editForm.status?.toLowerCase()?.replace('_','-')">
          {{statusLabel(editForm.status || '')}}
        </span>
      </div>

      <div class="form-body">
        <!-- Amount + Currency -->
        <div class="amount-row">
          <mat-form-field appearance="outline" class="amount-field">
            <mat-label>{{ isAr() ? 'المبلغ' : 'Amount' }}</mat-label>
            <input matInput type="number" min="0" [(ngModel)]="editForm.amount" placeholder="0.00">
            <mat-icon matSuffix>payments</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline" class="currency-field">
            <mat-label>{{ isAr() ? 'العملة' : 'Currency' }}</mat-label>
            <mat-select [(ngModel)]="editForm.currency">
              <mat-option *ngFor="let cur of enabledCurrencies()" [value]="cur.code">
                {{cur.flag}} {{cur.code}}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Linked Task -->
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>{{ isAr() ? 'المهمة المرتبطة (اختياري)' : 'Linked Task (optional)' }}</mat-label>
          <mat-select [(ngModel)]="editForm.taskId" (openedChange)="editTaskQ=''">
            <div class="select-search-wrap">
              <mat-icon class="select-search-icon">search</mat-icon>
              <input class="select-search-input"
                     [placeholder]="isAr() ? 'ابحث...' : 'Search...'"
                     [(ngModel)]="editTaskQ"
                     (keydown.space)="$event.stopPropagation()"
                     (click)="$event.stopPropagation()">
            </div>
            <mat-option [value]="null">
              <mat-icon style="font-size:15px;vertical-align:middle;color:var(--text-muted)">link_off</mat-icon>
              {{ isAr() ? 'بدون ربط' : 'No linked task' }}
            </mat-option>
            <mat-option *ngFor="let t of filteredTasksEdit()" [value]="t.id">
              <span class="opt-code">{{t.taskCode}}</span>
              {{ isAr() && t.titleAr ? t.titleAr : t.title }}
            </mat-option>
          </mat-select>
          <mat-icon matSuffix style="font-size:16px">link</mat-icon>
        </mat-form-field>

        <!-- Notes -->
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>{{ isAr() ? 'ملاحظات' : 'Notes' }}</mat-label>
          <textarea matInput [(ngModel)]="editForm.notes" rows="3"></textarea>
        </mat-form-field>

        <div class="edit-hint" *ngIf="editForm.status === 'POSTED'">
          <mat-icon>info</mat-icon>
          {{ isAr() ? 'هذا المستخلص مُدرج — التعديل متاح فقط للمسؤولين.' : 'This extract is POSTED — editing is restricted to admins only.' }}
        </div>
      </div>

      <div class="form-footer">
        <button mat-button (click)="showEdit.set(false)">{{ isAr() ? 'إلغاء' : 'Cancel' }}</button>
        <button mat-raised-button color="primary" (click)="submitEdit()" [disabled]="saving()">
          <mat-spinner diameter="18" *ngIf="saving()" style="display:inline-block;margin-inline-end:6px"></mat-spinner>
          <mat-icon *ngIf="!saving()">save</mat-icon>
          {{ isAr() ? 'حفظ التعديلات' : 'Save Changes' }}
        </button>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .summary-row { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
    .sum-chip {
      display:flex; align-items:center; gap:6px; padding:8px 16px; border-radius:20px;
      cursor:pointer; font-size:13px; font-weight:600; border:2px solid transparent; transition:all .2s;
      mat-icon { font-size:16px; width:16px; height:16px; }
      strong { font-size:15px; }
      &.active, &:hover { border-color: currentColor; }
    }
    .sum-chip.gray   { background:#f1f5f9; color:#64748b; }
    .sum-chip.amber  { background:#fffbeb; color:#d97706; }
    .sum-chip.blue   { background:#eff6ff; color:#2563eb; }
    .sum-chip.red    { background:#fef2f2; color:#dc2626; }
    .sum-chip.green  { background:#f0fdf4; color:#16a34a; }

    .filter-card { padding:16px; margin-bottom:16px; }
    .filter-row { display:flex; gap:12px; flex-wrap:wrap; align-items:center;
      mat-form-field { width:160px; }
      .search-field { flex:1; min-width:200px; }
    }

    .table-wrap { overflow:hidden; }
    table { width:100%; }
    th { font-size:12px; font-weight:700; color:var(--text-muted); background:var(--bg-main); }
    td { font-size:13px; border-bottom:1px solid var(--border-color); }
    .data-row { cursor:pointer; transition:background .15s; &:hover { background:var(--bg-main); } }
    .data-row.expanded { background:rgba(59,130,246,0.04); }
    .detail-row { height:0; }
    .detail-row td { padding:0; border:none; }

    .num-badge  { background:#1e3a5f; color:#fff; padding:2px 8px; border-radius:8px; font-size:12px; font-weight:700; font-family:monospace; }
    .code-badge { background:var(--bg-main); padding:2px 8px; border-radius:4px; font-size:11px; font-family:monospace; }
    .text-muted { color:var(--text-muted); }
    .loading-center { display:flex; justify-content:center; padding:60px; }

    .status-badge {
      padding:3px 12px; border-radius:20px; font-size:12px; font-weight:600;
      &.received     { background:#fffbeb; color:#d97706; }
      &.under-review { background:#eff6ff; color:#2563eb; }
      &.posted       { background:#f0fdf4; color:#16a34a; }
      &.returned     { background:#fef2f2; color:#dc2626; }
    }

    .actions-cell { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }

    .expand-panel {
      padding:16px 24px; display:flex; flex-direction:column; gap:12px;
      background:rgba(220,38,38,0.03); border-top:1px dashed rgba(220,38,38,0.2);
      &.empty { color:var(--text-muted); font-size:13px; display:flex; align-items:center; gap:8px; }
    }
    .return-note {
      display:flex; gap:12px; padding:12px; border-radius:10px;
      background:#fff5f5; border-left:3px solid #dc2626;
      mat-icon { color:#dc2626; flex-shrink:0; margin-top:2px; }
    }
    .note-header { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:4px; }
    .note-author { font-weight:700; font-size:13px; }
    .note-date   { font-size:11px; color:var(--text-muted); }
    .note-badge  { background:#fecaca; color:#dc2626; font-size:10px; font-weight:700; padding:1px 8px; border-radius:10px; }
    .note-text   { font-size:13px; color:var(--text-secondary); margin:0; }

    .form-overlay { position:fixed; inset:0; z-index:200; display:flex; align-items:center; justify-content:center; padding:20px; }
    .form-backdrop { position:absolute; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(3px); }
    .form-drawer {
      position:relative; z-index:201; width:480px; max-width:calc(100vw - 40px);
      height:min(90vh,560px); display:flex; flex-direction:column; overflow:hidden;
    }
    .form-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px 14px; flex-shrink:0; border-bottom:1px solid var(--border-color); }
    .form-body   { padding:16px 24px; display:flex; flex-direction:column; gap:12px; overflow-y:auto; flex:1; min-height:0; }
    .form-footer { display:flex; justify-content:flex-end; gap:8px; padding:12px 24px 16px; flex-shrink:0; border-top:1px solid var(--border-color); }
    .w-100 { width:100%; }
    .form-drawer { height:min(90vh,640px) !important; }

    /* ── Amount row ──────────────────────── */
    .amount-row { display:flex; gap:10px; }
    .amount-field { flex:2; }
    .currency-field { flex:1; }
    .amount-badge {
      font-family:monospace; font-size:12px; font-weight:700;
      color:#16a34a; background:#f0fdf4;
      padding:2px 8px; border-radius:6px;
      small { font-size:10px; color:#64748b; margin-inline-start:3px; }
    }

    /* ── Financial Banner ─────────────────── */
    .financial-banner {
      padding:14px 20px; margin-bottom:14px;
      background:linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border:1px solid #bbf7d0;
    }
    .fin-title {
      display:flex; align-items:center; gap:7px;
      font-weight:700; font-size:14px; color:#16a34a; margin-bottom:12px;
      mat-icon { font-size:18px; }
    }
    .fin-cards { display:flex; gap:10px; flex-wrap:wrap; }
    .fin-card {
      flex:1; min-width:130px; padding:10px 14px; border-radius:12px;
      display:flex; flex-direction:column; gap:2px;
      &.amber { background:#fffbeb; border:1px solid #fde68a; }
      &.blue  { background:#eff6ff; border:1px solid #bfdbfe; }
      &.green { background:#f0fdf4; border:1px solid #bbf7d0; }
      &.red   { background:#fef2f2; border:1px solid #fecaca; }
      &.grand { background:#1e3a5f; border:1px solid #1e3a5f; }
    }
    .fin-label  { font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; }
    .fin-card.grand .fin-label { color:rgba(255,255,255,0.7); }
    .fin-amount { font-size:18px; font-weight:800; font-family:monospace; color:var(--text-primary); }
    .fin-card.grand .fin-amount { color:#fff; }
    .fin-count  { font-size:11px; color:var(--text-muted); }
    .fin-card.grand .fin-count  { color:rgba(255,255,255,0.5); }

    /* ── Searchable select ─────────────────────────── */
    .select-search-wrap {
      display:flex; align-items:center; gap:6px;
      padding:6px 12px 4px; border-bottom:1px solid var(--border-color);
      position:sticky; top:0; background:#fff; z-index:1;
    }
    .select-search-icon { font-size:16px; width:16px; height:16px; color:var(--text-muted); flex-shrink:0; }
    .select-search-input {
      flex:1; border:none; outline:none; font-size:13px;
      background:transparent; color:inherit;
      font-family:inherit;
    }
    .opt-code {
      display:inline-block; font-family:monospace; font-size:11px;
      background:#f1f5f9; color:#2563eb; padding:1px 6px;
      border-radius:4px; margin-inline-end:6px;
    }

    /* ── Edit drawer extras ───────────────────────── */
    .edit-num-badge {
      display:inline-block; font-family:monospace; font-size:13px;
      background:#1e3a5f; color:#fff; padding:1px 9px;
      border-radius:8px; margin-inline-start:6px; vertical-align:middle;
    }
    .edit-info-bar {
      display:flex; align-items:center; gap:10px; flex-wrap:wrap;
      padding:8px 24px 0; font-size:12px; color:var(--text-secondary);
      mat-icon { font-size:14px; width:14px; height:14px; vertical-align:middle; }
    }
    .edit-info-item { display:flex; align-items:center; gap:4px; }
    .edit-status-badge {
      padding:2px 10px; border-radius:20px; font-size:11px; font-weight:700;
      &.received     { background:#fffbeb; color:#d97706; }
      &.under-review { background:#eff6ff; color:#2563eb; }
      &.posted       { background:#f0fdf4; color:#16a34a; }
      &.returned     { background:#fef2f2; color:#dc2626; }
    }
    .edit-hint {
      display:flex; align-items:center; gap:6px; padding:10px 14px;
      background:#fffbeb; border:1px solid #fde68a; border-radius:8px;
      font-size:12px; color:#92400e;
      mat-icon { font-size:16px; width:16px; height:16px; }
    }
  `]
})
export class ExtractsPageComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  extracts     = signal<any[]>([]);
  contractors  = signal<any[]>([]);
  projects     = signal<any[]>([]);
  tasks              = signal<any[]>([]);
  enabledCurrencies  = signal<{code:string;flag:string;name:string;nameAr:string}[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  showCreate   = signal(false);
  showEdit     = signal(false);
  expandedRow: any = null;

  ds = new MatTableDataSource<any>([]);
  cols = ['extractNumber','contractor','project','status','task','amount','receivedAt','actions'];

  filterStatus     = '';
  filterProject    = '';
  filterContractor = '';
  filterSearch     = '';
  filterFrom: Date | null = null;
  filterTo:   Date | null = null;

  newForm = { extractNumber: null as any, contractorId: null as any, projectId: null as any, taskId: null as any, notes: '', amount: null as any, currency: 'EGP' };

  // ── Edit form state ──
  editForm: { id: number; extractNumber: number; contractorName: string; projectName: string; status: string; amount: any; currency: string; notes: string; taskId: any } = {
    id: 0, extractNumber: 0, contractorName: '', projectName: '', status: '', amount: null, currency: 'EGP', notes: '', taskId: null,
  };
  editTaskQ = '';

  summary          = signal({ total:0, received:0, underReview:0, returned:0, posted:0 });
  financialSummary = signal<any>(null);

  // ── Searchable dropdowns ──
  filterContractorQ = '';
  formContractorQ   = '';
  formTaskQ         = '';

  filteredContractors = () => {
    const q = this.filterContractorQ.trim().toLowerCase();
    if (!q) return this.contractors();
    return this.contractors().filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.nameAr?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q)
    );
  };

  filteredContractorsForm = () => {
    const q = this.formContractorQ.trim().toLowerCase();
    if (!q) return this.contractors();
    return this.contractors().filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.nameAr?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q)
    );
  };

  filteredTasksForm = () => {
    const q = this.formTaskQ.trim().toLowerCase();
    if (!q) return this.tasks();
    return this.tasks().filter(t =>
      t.taskCode?.toLowerCase().includes(q) ||
      t.title?.toLowerCase().includes(q) ||
      t.titleAr?.toLowerCase().includes(q)
    );
  };

  filteredTasksEdit = () => {
    const q = this.editTaskQ.trim().toLowerCase();
    if (!q) return this.tasks();
    return this.tasks().filter(t =>
      t.taskCode?.toLowerCase().includes(q) ||
      t.title?.toLowerCase().includes(q) ||
      t.titleAr?.toLowerCase().includes(q)
    );
  };

  isAr      = () => this.lang.getCurrentLang() === 'ar';
  canCreate = () => (this.auth.currentUser()?.role?.level ?? 99) <= 4;
  canDelete = () => (this.auth.currentUser()?.role?.level ?? 99) <= 2;
  roleLevel = () => this.auth.currentUser()?.role?.level ?? 99;

  // Can edit: SUPERVISOR+ for non-POSTED; ADMIN+ for POSTED
  canEdit = (r: any) => {
    const lv = this.roleLevel();
    if (r.status === 'POSTED') return lv <= 2;
    return lv <= 4;
  };

  constructor(
    private svc: ExtractService,
    private auth: AuthService,
    private lang: LangService,
    private taskSvc: TaskService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
  ) {}

  // Full currency definitions (code + emoji flag + bilingual name)
  readonly ALL_CURRENCIES = [
    { code: 'EGP', flag: '🇪🇬', name: 'Egyptian Pound',  nameAr: 'جنيه مصري' },
    { code: 'USD', flag: '🇺🇸', name: 'US Dollar',        nameAr: 'دولار أمريكي' },
    { code: 'EUR', flag: '🇪🇺', name: 'Euro',             nameAr: 'يورو' },
    { code: 'SAR', flag: '🇸🇦', name: 'Saudi Riyal',      nameAr: 'ريال سعودي' },
    { code: 'AED', flag: '🇦🇪', name: 'UAE Dirham',       nameAr: 'درهم إماراتي' },
    { code: 'KWD', flag: '🇰🇼', name: 'Kuwaiti Dinar',    nameAr: 'دينار كويتي' },
    { code: 'QAR', flag: '🇶🇦', name: 'Qatari Riyal',     nameAr: 'ريال قطري' },
    { code: 'GBP', flag: '🇬🇧', name: 'British Pound',    nameAr: 'جنيه بريطاني' },
  ];

  ngOnInit() {
    this.svc.getContractors().subscribe(r => { if (r.success) this.contractors.set(r.data); });
    this.svc.getProjects().subscribe(r => { if (r.success) this.projects.set(r.data); });
    this.taskSvc.getAll().subscribe(r => { if (r.success) this.tasks.set(r.data); });
    // Load enabled currencies from settings; fallback to full list
    this.svc.getCurrencies().subscribe({
      next: r => {
        if (r.success && r.data?.length) {
          const codes: string[] = r.data;
          const filtered = this.ALL_CURRENCIES.filter(c => codes.includes(c.code));
          this.enabledCurrencies.set(filtered.length ? filtered : this.ALL_CURRENCIES);
          // Set default currency for new form to first enabled
          if (filtered.length) this.newForm.currency = filtered[0].code;
        } else {
          this.enabledCurrencies.set(this.ALL_CURRENCIES);
        }
      },
      error: () => this.enabledCurrencies.set(this.ALL_CURRENCIES),
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    const f: any = {};
    if (this.filterStatus)     f.status       = this.filterStatus;
    if (this.filterProject)    f.projectId    = this.filterProject;
    if (this.filterContractor) f.contractorId = this.filterContractor;
    if (this.filterSearch)     f.search       = this.filterSearch;
    if (this.filterFrom)       f.dateFrom     = this.filterFrom.toISOString();
    if (this.filterTo)         f.dateTo       = this.filterTo.toISOString();

    this.svc.getAll(f).subscribe({
      next: r => {
        this.loading.set(false);
        if (r.success) {
          this.ds.data = r.data.extracts;
          setTimeout(() => { this.ds.paginator = this.paginator; });
          const s = r.data.summary as { status: string; _count: { id: number } }[];
          const cnt = (st: string) => s.find(x => x.status === st)?._count?.id ?? 0;
          this.summary.set({ total: r.data.total, received: cnt('RECEIVED'), underReview: cnt('UNDER_REVIEW'), returned: cnt('RETURNED'), posted: cnt('POSTED') });
        }
      },
      error: () => this.loading.set(false),
    });

    this.loadFinancialSummary(f);
  }

  loadFinancialSummary(f: any) {
    this.svc.getFinancialSummary(f).subscribe(r => {
      if (r.success) this.financialSummary.set(r.data);
    });
  }

  formatAmount(amount: number | undefined | null): string {
    if (amount === null || amount === undefined) return '0';
    return new Intl.NumberFormat(this.isAr() ? 'ar-EG' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
  }

  setFilter(s: string) { this.filterStatus = s; this.load(); }
  toggleExpand(r: any) { this.expandedRow = this.expandedRow === r ? null : r; }
  openCreate() { this.newForm = { extractNumber: null, contractorId: null, projectId: null, taskId: null, notes: '', amount: null, currency: 'EGP' }; this.showCreate.set(true); }

  openEdit(r: any) {
    this.editTaskQ = '';
    this.editForm = {
      id:              r.id,
      extractNumber:   r.extractNumber,
      contractorName:  r.contractor?.name ?? '',
      projectName:     r.project?.name ?? '',
      status:          r.status,
      amount:          r.amount ?? null,
      currency:        r.currency ?? 'EGP',
      notes:           r.notes ?? '',
      taskId:          r.task?.id ?? null,
    };
    this.showEdit.set(true);
  }

  submitEdit() {
    this.saving.set(true);
    const payload: any = {
      amount:   this.editForm.amount !== '' ? this.editForm.amount : null,
      currency: this.editForm.currency,
      notes:    this.editForm.notes,
      taskId:   this.editForm.taskId,
    };
    this.svc.update(this.editForm.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.showEdit.set(false);
        this.load();
        this.snack.open(this.isAr() ? 'تم حفظ التعديلات ✓' : 'Changes saved ✓', '', { duration: 2500 });
      },
      error: (e) => {
        this.saving.set(false);
        this.snack.open(e.error?.message || (this.isAr() ? 'حدث خطأ' : 'Error'), 'X', { duration: 4000 });
      },
    });
  }

  submitCreate() {
    this.saving.set(true);
    this.svc.create(this.newForm).subscribe({
      next: () => { this.saving.set(false); this.showCreate.set(false); this.load(); this.snack.open(this.isAr() ? 'تم الحفظ' : 'Saved', '✓', { duration: 2500 }); },
      error: (e) => { this.saving.set(false); this.snack.open(e.error?.message || 'Error', 'X'); },
    });
  }

  canTransition(r: any, to: string): boolean {
    const lv = this.roleLevel();
    if (r.status === 'RECEIVED'     && to === 'UNDER_REVIEW') return lv <= 4;
    if (r.status === 'UNDER_REVIEW' && to === 'POSTED')       return lv <= 3;
    if (r.status === 'RETURNED'     && to === 'UNDER_REVIEW') return lv <= 4;
    return false;
  }

  canReturn(r: any): boolean {
    const lv = this.roleLevel();
    if (r.status === 'UNDER_REVIEW') return lv <= 4;
    if (r.status === 'POSTED')       return lv <= 3;
    return false;
  }

  doTransition(r: any, to: string) {
    this.svc.updateStatus(r.id, to).subscribe({
      next: () => { this.load(); this.snack.open(this.isAr() ? 'تم التحديث' : 'Updated', '✓', { duration: 2000 }); },
      error: (e) => this.snack.open(e.error?.message || 'Error', 'X'),
    });
  }

  openReturn(r: any) {
    const ref = this.dialog.open(ReturnCommentDialogComponent, {
      width: '480px', disableClose: true,
      data: { extractId: r.id, extractNumber: r.extractNumber, contractorName: r.contractor?.name, projectName: r.project?.name, fromStatus: r.status },
    });
    ref.afterClosed().subscribe(result => { if (result) { this.load(); this.snack.open(this.isAr() ? 'تم الإرجاع' : 'Returned', '✓', { duration: 2500 }); } });
  }

  showQR(r: any) {
    const url = window.location.origin + '/extracts'; // Go to extracts page
    import('../../shared/components/qr-dialog/qr-dialog.component').then(m => {
      this.dialog.open(m.QrDialogComponent, {
        data: {
          title: this.isAr() ? 'رمز المستخلص' : 'Extract QR Code',
          subtitle: '#' + r.extractNumber + ' - ' + r.contractor?.name,
          url: url
        },
        width: '350px'
      });
    });
  }

  statusLabel(s: string): string {
    const map: any = { RECEIVED:'استلام', UNDER_REVIEW:'مراجعة', POSTED:'مُدرج', RETURNED:'مُرجَع' };
    const enMap: any = { RECEIVED:'Received', UNDER_REVIEW:'Under Review', POSTED:'Posted', RETURNED:'Returned' };
    return this.isAr() ? (map[s]||s) : (enMap[s]||s);
  }

  deleteItem(id: number, extractNum: number) {
    if (!confirm(this.isAr() ? `هل أنت متأكد من حذف المستخلص رقم #${extractNum}؟` : `Are you sure you want to delete extract #${extractNum}?`)) return;
    this.svc.delete(id).subscribe({
      next: () => { this.load(); this.snack.open(this.isAr() ? 'تم الحذف' : 'Deleted', '✓', { duration: 2500 }); },
      error: e => this.snack.open(e.error?.message || 'Error', 'X'),
    });
  }
}
