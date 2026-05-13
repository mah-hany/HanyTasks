import sys
import re

path = r'src/app/features/chat/chat.component.ts'
with open(path, encoding='utf-8') as f:
    content = f.read()

# 1. Add view type: 'list' | 'new' | 'messages' | 'new_group'
content = content.replace("view = signal<'list' | 'new' | 'messages'>('list');", "view = signal<'list' | 'new' | 'messages' | 'new_group'>('list');")

# 2. Add properties for group creation
props = """  groupName = '';
  selectedGroupUsers = new Set<number>();
"""
content = content.replace("newMessage = '';", "newMessage = '';\n" + props)

# 3. Add UI for 'new' view to include "Create Group" button
old_new_view = """        <!-- ── NEW CHAT view ── -->
        <ng-container *ngIf="view() === 'new'">
          <div class="panel-header">
            <button class="icon-btn" (click)="view.set('list')">
              <mat-icon>arrow_forward</mat-icon>
            </button>
            <div class="header-title">محادثة جديدة</div>
          </div>

          <div class="search-box">
            <mat-icon>search</mat-icon>
            <input type="text" placeholder="ابحث عن موظف..." [(ngModel)]="userSearchQuery" id="user-search-input" autofocus/>
          </div>

          <div class="conv-list">
            <div class="conv-item" *ngFor="let u of filteredUsers()" (click)="startNewChat(u)">
              <div class="conv-avatar">
                <img *ngIf="u.profilePhoto" [src]="u.profilePhoto" alt="">
                <span *ngIf="!u.profilePhoto">{{ u.fullNameAr.charAt(0) }}</span>
              </div>
              <div class="conv-info">
                <div class="conv-name">{{ u.fullNameAr }}</div>
                <div class="conv-last">{{ u.role?.nameAr }}</div>
              </div>
            </div>
          </div>
        </ng-container>"""

new_new_view = """        <!-- ── NEW CHAT view ── -->
        <ng-container *ngIf="view() === 'new'">
          <div class="panel-header">
            <button class="icon-btn" (click)="view.set('list')">
              <mat-icon>arrow_forward</mat-icon>
            </button>
            <div class="header-title">محادثة جديدة</div>
            <button class="icon-btn" (click)="showNewGroup()" matTooltip="إنشاء مجموعة">
              <mat-icon>group_add</mat-icon>
            </button>
          </div>

          <div class="search-box">
            <mat-icon>search</mat-icon>
            <input type="text" placeholder="ابحث عن موظف..." [(ngModel)]="userSearchQuery" id="user-search-input" autofocus/>
          </div>

          <div class="conv-list">
            <div class="conv-item" *ngFor="let u of filteredUsers()" (click)="startNewChat(u)">
              <div class="conv-avatar">
                <img *ngIf="u.profilePhoto" [src]="u.profilePhoto" alt="">
                <span *ngIf="!u.profilePhoto">{{ u.fullNameAr.charAt(0) }}</span>
              </div>
              <div class="conv-info">
                <div class="conv-name">{{ u.fullNameAr }}</div>
                <div class="conv-last">{{ u.role?.nameAr }}</div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ── NEW GROUP view ── -->
        <ng-container *ngIf="view() === 'new_group'">
          <div class="panel-header">
            <button class="icon-btn" (click)="view.set('new')">
              <mat-icon>arrow_forward</mat-icon>
            </button>
            <div class="header-title">مجموعة جديدة</div>
          </div>

          <div style="padding: 10px 14px; border-bottom: 1px solid var(--border-color, #e2e8f0);">
            <input type="text" placeholder="اسم المجموعة..." [(ngModel)]="groupName" style="width: 100%; border: none; outline: none; padding: 8px; font-family: Cairo; background: var(--bg-main, #f8fafc); border-radius: 8px;">
          </div>

          <div class="search-box">
            <mat-icon>search</mat-icon>
            <input type="text" placeholder="ابحث لإضافة أعضاء..." [(ngModel)]="userSearchQuery" />
          </div>

          <div class="conv-list" style="max-height: 250px;">
            <div class="conv-item" *ngFor="let u of filteredUsers()" (click)="toggleGroupUser(u.id)" [class.has-unread]="selectedGroupUsers.has(u.id)">
              <div class="conv-avatar small">
                <span *ngIf="!u.profilePhoto">{{ u.fullNameAr.charAt(0) }}</span>
              </div>
              <div class="conv-info">
                <div class="conv-name">{{ u.fullNameAr }}</div>
              </div>
              <mat-icon *ngIf="selectedGroupUsers.has(u.id)" style="color: #f97316; font-size: 18px;">check_circle</mat-icon>
            </div>
          </div>

          <div style="padding: 10px; display: flex; justify-content: flex-end; border-top: 1px solid var(--border-color, #e2e8f0);">
            <button class="btn-new" (click)="createGroupSubmit()" [disabled]="!groupName.trim() || selectedGroupUsers.size === 0">إنشاء</button>
          </div>
        </ng-container>"""

if old_new_view in content:
    content = content.replace(old_new_view, new_new_view)
elif old_new_view.replace('\n', '\r\n') in content:
    content = content.replace(old_new_view.replace('\n', '\r\n'), new_new_view)
else:
    print("COULD NOT FIND NEW VIEW HTML")

# 4. Add logic methods
methods = """
  showNewGroup() {
    this.groupName = '';
    this.selectedGroupUsers.clear();
    this.userSearchQuery = '';
    this.view.set('new_group');
  }

  toggleGroupUser(id: number) {
    if (this.selectedGroupUsers.has(id)) {
      this.selectedGroupUsers.delete(id);
    } else {
      this.selectedGroupUsers.add(id);
    }
  }

  createGroupSubmit() {
    if (!this.groupName.trim() || this.selectedGroupUsers.size === 0) return;
    this.chatService.createGroup(this.groupName, Array.from(this.selectedGroupUsers)).subscribe(res => {
      if (res.success && res.data) {
        this.chatService.openChat(-res.data.id);
        this.view.set('messages');
        this.shouldScroll = true;
      }
    });
  }
"""

old_start = """  startNewChat(user: ChatUser) {"""
new_start = methods + "\n  startNewChat(user: ChatUser) {"

if old_start in content:
    content = content.replace(old_start, new_start)
elif old_start.replace('\n', '\r\n') in content:
    content = content.replace(old_start.replace('\n', '\r\n'), new_start)
else:
    print("COULD NOT FIND LOGIC")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS")
