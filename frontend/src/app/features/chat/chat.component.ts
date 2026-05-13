import {
  Component, OnInit, OnDestroy, signal, computed,
  ViewChild, ElementRef, AfterViewChecked, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChatService, ChatUser, ChatConversation } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  template: `
    <!-- Floating Chat Bubble -->
    <div class="chat-wrapper">

      <!-- Floating Button -->
      <button class="chat-fab" (click)="togglePanel()" id="chat-fab-btn"
              [class.has-unread]="chatService.unreadTotal() > 0"
              matTooltip="الدردشة">
        <mat-icon>{{ chatService.isChatOpen() ? 'close' : 'chat_bubble' }}</mat-icon>
        <span class="fab-badge" *ngIf="chatService.unreadTotal() > 0 && !chatService.isChatOpen()">
          {{ chatService.unreadTotal() > 99 ? '99+' : chatService.unreadTotal() }}
        </span>
      </button>

      <!-- Chat Panel -->
      <div class="chat-panel" [class.open]="chatService.isChatOpen()">

        <!-- ── CONVERSATION LIST view ── -->
        <ng-container *ngIf="view() === 'list'">
          <div class="panel-header">
            <div class="header-title">
              <mat-icon>forum</mat-icon>
              <span>الدردشة</span>
            </div>
            <button class="icon-btn" (click)="showNewChat()" matTooltip="محادثة جديدة">
              <mat-icon>edit</mat-icon>
            </button>
          </div>

          <!-- Search -->
          <div class="search-box">
            <mat-icon>search</mat-icon>
            <input type="text" placeholder="بحث عن محادثة..." [(ngModel)]="searchQuery" id="chat-search-input"/>
          </div>

          <!-- Conversations -->
          <div class="conv-list">
            <div *ngIf="filteredConvs().length === 0" class="empty-state">
              <mat-icon>chat_bubble_outline</mat-icon>
              <p>لا توجد محادثات</p>
              <button class="btn-new" (click)="showNewChat()">ابدأ محادثة جديدة</button>
            </div>

            <div class="conv-item" *ngFor="let conv of filteredConvs()"
                 (click)="openConversation(conv)"
                 [class.has-unread]="conv.unreadCount > 0">
              <div class="conv-avatar">
                <img *ngIf="getPartner(conv).profilePhoto" [src]="getPartner(conv).profilePhoto" alt="">
                <span *ngIf="!getPartner(conv).profilePhoto">{{ getPartner(conv).fullNameAr.charAt(0) }}</span>
              </div>
              <div class="conv-info">
                <div class="conv-name">{{ getPartner(conv).fullNameAr }}</div>
                <div class="conv-last">{{ conv.lastMessage || 'ابدأ المحادثة...' }}</div>
              </div>
              <div class="conv-meta">
                <span class="conv-time" *ngIf="conv.lastAt">{{ formatTime(conv.lastAt) }}</span>
                <span class="unread-badge" *ngIf="conv.unreadCount > 0">{{ conv.unreadCount }}</span>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ── NEW CHAT view ── -->
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
        </ng-container>

        <!-- ── MESSAGES view ── -->
        <ng-container *ngIf="view() === 'messages'">
          <div class="panel-header">
            <button class="icon-btn" (click)="backToList()">
              <mat-icon>arrow_forward</mat-icon>
            </button>
            <div class="active-user-info" *ngIf="activeUser()">
              <div class="conv-avatar small">
                <img *ngIf="activeUser()!.profilePhoto" [src]="activeUser()!.profilePhoto" alt="">
                <span *ngIf="!activeUser()!.profilePhoto">{{ activeUser()!.fullNameAr.charAt(0) }}</span>
              </div>
              <div>
                <div class="header-name">{{ activeUser()!.fullNameAr }}</div>
                <div class="typing-indicator" *ngIf="isTyping()">يكتب...</div>
              </div>
            </div>
          </div>

          <!-- Messages area -->
          <div class="messages-area" #msgContainer>
            <div *ngIf="chatService.isLoadingMessages()" class="loading-msgs">
              <div class="spinner"></div>
            </div>

            <div *ngIf="!chatService.isLoadingMessages() && chatService.messages().length === 0" class="empty-state">
              <mat-icon>chat_bubble_outline</mat-icon>
              <p>ابدأ المحادثة الآن!</p>
            </div>

            <div *ngFor="let msg of chatService.messages()"
                 class="msg-bubble"
                 [class.mine]="msg.senderId === myId()"
                 [class.theirs]="msg.senderId !== myId()">
              <div class="bubble-text">{{ msg.text }}</div>
              <div class="bubble-time">{{ formatTime(msg.createdAt) }}</div>
            </div>
          </div>

          <!-- Input -->
          <div class="msg-input-area">
            <textarea
              #msgInput
              class="msg-input"
              placeholder="اكتب رسالة..."
              [(ngModel)]="newMessage"
              (keydown.enter)="onEnterKey($event)"
              (input)="onTyping()"
              rows="1"
              id="chat-msg-input">
            </textarea>
            <button class="send-btn" (click)="sendMessage()" [disabled]="!newMessage.trim()" id="chat-send-btn">
              <mat-icon>send</mat-icon>
            </button>
          </div>
        </ng-container>

      </div>
    </div>
  `,
  styles: [`
    .chat-wrapper {
      position: fixed;
      bottom: 28px;
      inset-inline-end: 28px;
      z-index: 9999;
      direction: rtl;
    }

    /* ── FAB Button ── */
    .chat-fab {
      width: 58px; height: 58px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f97316, #ea580c);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      box-shadow: 0 8px 30px rgba(249,115,22,0.45);
      transition: all 0.25s cubic-bezier(.4,0,.2,1);
      position: relative;
      mat-icon { font-size: 26px; width: 26px; height: 26px; }

      &:hover { transform: scale(1.08); box-shadow: 0 12px 35px rgba(249,115,22,0.55); }
      &.has-unread { animation: pulse-ring 1.8s infinite; }
    }

    @keyframes pulse-ring {
      0% { box-shadow: 0 8px 30px rgba(249,115,22,0.45), 0 0 0 0 rgba(249,115,22,0.4); }
      70% { box-shadow: 0 8px 30px rgba(249,115,22,0.45), 0 0 0 14px rgba(249,115,22,0); }
      100% { box-shadow: 0 8px 30px rgba(249,115,22,0.45), 0 0 0 0 rgba(249,115,22,0); }
    }

    .fab-badge {
      position: absolute;
      top: -4px; inset-inline-start: -4px;
      background: #ef4444; color: #fff;
      font-size: 10px; font-weight: 700;
      padding: 2px 5px; border-radius: 20px;
      min-width: 18px; text-align: center;
      border: 2px solid #fff;
    }

    /* ── Chat Panel ── */
    .chat-panel {
      position: absolute;
      bottom: 72px;
      inset-inline-end: 0;
      width: 360px;
      height: 520px;
      background: var(--bg-card, #fff);
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.18);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: scale(0.85) translateY(20px);
      transform-origin: bottom right;
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(.4,0,.2,1);
      border: 1px solid var(--border-color, #e2e8f0);
    }

    .chat-panel.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    /* ── Panel Header ── */
    .panel-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: linear-gradient(135deg, #1e1b4b, #312e81);
      color: #fff;
      flex-shrink: 0;
    }

    .header-title {
      display: flex; align-items: center; gap: 8px;
      flex: 1; font-weight: 600; font-size: 15px;
      mat-icon { font-size: 20px; }
    }

    .icon-btn {
      background: rgba(255,255,255,0.12); border: none; cursor: pointer;
      width: 34px; height: 34px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff; transition: background 0.2s;
      flex-shrink: 0;
      mat-icon { font-size: 18px; }
      &:hover { background: rgba(255,255,255,0.22); }
    }

    .active-user-info {
      display: flex; align-items: center; gap: 10px; flex: 1;
    }

    .header-name { font-weight: 600; font-size: 14px; }
    .typing-indicator {
      font-size: 11px; color: rgba(255,255,255,0.6);
      animation: blink 1.2s infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; } 50% { opacity: 0.4; }
    }

    /* ── Search ── */
    .search-box {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border-color, #e2e8f0);
      flex-shrink: 0;
      mat-icon { color: var(--text-secondary, #94a3b8); font-size: 18px; }
      input {
        flex: 1; border: none; outline: none; background: transparent;
        font-size: 13px; color: var(--text-main, #1e293b);
        font-family: 'Cairo', sans-serif;
        &::placeholder { color: var(--text-secondary, #94a3b8); }
      }
    }

    /* ── Conversation List ── */
    .conv-list {
      flex: 1; overflow-y: auto;
      padding: 6px 0;

      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-thumb { background: var(--border-color, #e2e8f0); border-radius: 4px; }
    }

    .conv-item {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 16px; cursor: pointer;
      transition: background 0.15s;
      &:hover { background: var(--bg-main, #f8fafc); }
      &.has-unread { background: rgba(249,115,22,0.05); }
    }

    .conv-avatar {
      width: 42px; height: 42px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f97316, #ea580c);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 700; font-size: 16px;
      flex-shrink: 0; overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
      &.small { width: 34px; height: 34px; font-size: 13px; }
    }

    .conv-info { flex: 1; min-width: 0; }
    .conv-name { font-weight: 600; font-size: 14px; color: var(--text-main, #1e293b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .conv-last { font-size: 12px; color: var(--text-secondary, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }

    .conv-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
    .conv-time { font-size: 11px; color: var(--text-secondary, #94a3b8); }
    .unread-badge {
      background: #f97316; color: #fff;
      font-size: 10px; font-weight: 700;
      padding: 2px 6px; border-radius: 20px; min-width: 18px; text-align: center;
    }

    /* ── Empty State ── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; gap: 10px; color: var(--text-secondary, #94a3b8);
      mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.4; }
      p { font-size: 14px; margin: 0; }
    }

    .btn-new {
      background: linear-gradient(135deg, #f97316, #ea580c);
      color: #fff; border: none; cursor: pointer;
      padding: 8px 20px; border-radius: 20px; font-size: 13px;
      font-family: 'Cairo', sans-serif; font-weight: 600;
      transition: opacity 0.2s;
      &:hover { opacity: 0.9; }
    }

    /* ── Messages ── */
    .messages-area {
      flex: 1; overflow-y: auto;
      padding: 14px 14px 8px;
      display: flex; flex-direction: column; gap: 6px;

      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-thumb { background: var(--border-color, #e2e8f0); border-radius: 4px; }
    }

    .msg-bubble {
      display: flex; flex-direction: column;
      max-width: 75%;

      &.mine {
        align-self: flex-start;
        .bubble-text {
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: #fff; border-radius: 18px 18px 18px 4px;
        }
        .bubble-time { text-align: right; }
      }

      &.theirs {
        align-self: flex-end;
        .bubble-text {
          background: var(--bg-main, #f1f5f9);
          color: var(--text-main, #1e293b);
          border-radius: 18px 18px 4px 18px;
        }
        .bubble-time { text-align: left; }
      }
    }

    .bubble-text {
      padding: 9px 13px; font-size: 13.5px;
      line-height: 1.45; word-break: break-word;
    }

    .bubble-time {
      font-size: 10px; color: var(--text-secondary, #94a3b8);
      padding: 2px 4px;
    }

    /* ── Input Area ── */
    .msg-input-area {
      display: flex; align-items: flex-end; gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid var(--border-color, #e2e8f0);
      flex-shrink: 0;
    }

    .msg-input {
      flex: 1; border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 20px; padding: 9px 14px;
      font-family: 'Cairo', sans-serif; font-size: 13.5px;
      color: var(--text-main, #1e293b); background: var(--bg-main, #f8fafc);
      resize: none; outline: none; max-height: 100px;
      transition: border-color 0.2s;
      &:focus { border-color: #f97316; }
      &::placeholder { color: var(--text-secondary, #94a3b8); }
    }

    .send-btn {
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #f97316, #ea580c);
      border: none; cursor: pointer; color: #fff;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
      mat-icon { font-size: 18px; }
      &:hover:not(:disabled) { transform: scale(1.08); }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }

    /* ── Loading ── */
    .loading-msgs {
      display: flex; justify-content: center; padding: 20px;
    }

    .spinner {
      width: 28px; height: 28px;
      border: 3px solid var(--border-color, #e2e8f0);
      border-top-color: #f97316;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Mobile ── */
    @media (max-width: 480px) {
      .chat-wrapper { bottom: 16px; inset-inline-end: 16px; }
      .chat-panel { width: calc(100vw - 32px); height: 70vh; bottom: 68px; }
    }

    /* ── Dark mode ── */
    :host-context(.dark-theme) {
      .chat-panel {
        background: #1e293b;
        border-color: #334155;
      }
      .conv-item:hover { background: #0f172a; }
      .conv-item.has-unread { background: rgba(249,115,22,0.08); }
      .msg-input { background: #0f172a; border-color: #334155; color: #f1f5f9; }
      .msg-bubble.theirs .bubble-text { background: #334155; color: #f1f5f9; }
      .search-box { border-color: #334155; }
      .msg-input-area { border-color: #334155; }
      .search-box input { color: #f1f5f9; }
    }
  `],
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('msgContainer') msgContainer!: ElementRef;

  chatService = inject(ChatService);
  private authService = inject(AuthService);

  view = signal<'list' | 'new' | 'messages' | 'new_group'>('list');
  searchQuery = '';
  userSearchQuery = '';
  newMessage = '';
  groupName = '';
  selectedGroupUsers = new Set<number>();

  private typingTimeout: any;
  private shouldScroll = false;

  myId = computed(() => this.authService.currentUser()?.id ?? 0);

  activeUser = computed<ChatUser | null>(() => {
    const otherId = this.chatService.activeConvUserId();
    if (!otherId) return null;
    // Check in conversations first
    const conv = this.chatService.conversations().find(c =>
      c.user1Id === otherId || c.user2Id === otherId
    );
    if (conv) return this.chatService.getConvPartner(conv, this.myId());
    // Fallback to allUsers
    return this.chatService.allUsers().find(u => u.id === otherId) ?? null;
  });

  isTyping = computed(() => {
    const otherId = this.chatService.activeConvUserId();
    return otherId ? this.chatService.typingUsers().has(otherId) : false;
  });

  filteredConvs = computed(() => {
    const q = this.searchQuery.toLowerCase();
    return this.chatService.conversations().filter(conv => {
      const partner = this.getPartner(conv);
      return !q || partner.fullNameAr.toLowerCase().includes(q) || partner.fullName.toLowerCase().includes(q);
    });
  });

  filteredUsers = computed(() => {
    const q = this.userSearchQuery.toLowerCase();
    return this.chatService.allUsers().filter(u =>
      !q || u.fullNameAr.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q)
    );
  });

  ngOnInit() {
    this.chatService.loadConversations().subscribe();
    this.chatService.loadUnreadCount().subscribe();
    this.chatService.loadUsers().subscribe();
  }

  ngOnDestroy() {
    clearTimeout(this.typingTimeout);
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  togglePanel() {
    const open = !this.chatService.isChatOpen();
    this.chatService.isChatOpen.set(open);
    if (open && this.view() === 'messages') {
      this.shouldScroll = true;
    }
  }

  showNewChat() {
    this.userSearchQuery = '';
    this.view.set('new');
  }

  openConversation(conv: ChatConversation) {
    const partner = this.getPartner(conv);
    this.chatService.openChat(partner.id);
    this.view.set('messages');
    this.shouldScroll = true;
  }


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

  startNewChat(user: ChatUser) {
    this.chatService.openChat(user.id);
    this.view.set('messages');
    this.shouldScroll = true;
  }

  backToList() {
    this.chatService.closeChat();
    this.view.set('list');
    this.chatService.loadConversations().subscribe();
    this.chatService.loadUnreadCount().subscribe();
  }

  sendMessage() {
    const text = this.newMessage.trim();
    const otherId = this.chatService.activeConvUserId();
    if (!text || !otherId) return;
    this.newMessage = '';
    this.chatService.sendMessage(otherId, text).subscribe();
    this.chatService.emitTyping(otherId, false);
    clearTimeout(this.typingTimeout);
    this.shouldScroll = true;
  }

  onEnterKey(event: Event) {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.sendMessage();
    }
  }

  onTyping() {
    const otherId = this.chatService.activeConvUserId();
    if (!otherId) return;
    this.chatService.emitTyping(otherId, true);
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.chatService.emitTyping(otherId, false);
    }, 2000);
  }

  getPartner(conv: ChatConversation): ChatUser {
    return this.chatService.getConvPartner(conv, this.myId());
  }

  formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}د`;
    if (diff < 86400000) return d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
  }

  private scrollToBottom() {
    try {
      const el = this.msgContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch (_) {}
  }
}
