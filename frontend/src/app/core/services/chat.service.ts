import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

export interface ChatUser {
  id: number;
  fullName: string;
  fullNameAr: string;
  profilePhoto?: string;
  role?: { name: string; nameAr: string };
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  text: string;
  isRead: boolean;
  createdAt: string;
  sender?: ChatUser;
}

export interface ChatConversation {
  id: number;
  user1Id: number;
  user2Id: number;
  lastMessage?: string;
  lastAt?: string;
  unreadCount: number;
  user1: ChatUser;
  user2: ChatUser;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private socket: Socket | null = null;

  conversations = signal<ChatConversation[]>([]);
  activeConvUserId = signal<number | null>(null);
  messages = signal<ChatMessage[]>([]);
  unreadTotal = signal<number>(0);
  isChatOpen = signal<boolean>(false);
  typingUsers = signal<Set<number>>(new Set());
  isLoadingMessages = signal<boolean>(false);
  allUsers = signal<ChatUser[]>([]);

  constructor(private http: HttpClient) {}

  connectSocket(userId: number) {
    if (this.socket?.connected) return;
    this.socket = io(environment.socketUrl, {
      auth: { userId },
      transports: ['websocket'],
    });

    // Incoming message from another user
    this.socket.on('chat:message', (payload: { conversationId: number; message: ChatMessage }) => {
      // Add to messages if this conversation is open
      if (this.activeConvUserId() !== null) {
        const other = this.getOtherUserId(payload.conversationId, userId);
        if (other !== null && other === this.activeConvUserId()) {
          this.messages.update(msgs => [...msgs, payload.message]);
          // Mark read immediately
          this.markRead(other, userId).subscribe();
        }
      }
      // Update conversation list
      this.loadConversations().subscribe();
      // Update unread total
      this.loadUnreadCount().subscribe();
    });

    // Sent message echo (multi-tab sync)
    this.socket.on('chat:message:sent', (payload: { conversationId: number; message: ChatMessage }) => {
      const other = this.getOtherUserId(payload.conversationId, userId);
      if (other === this.activeConvUserId()) {
        this.messages.update(msgs => {
          // Avoid duplicate if REST already added it
          if (msgs.find(m => m.id === payload.message.id)) return msgs;
          return [...msgs, payload.message];
        });
      }
      this.loadConversations().subscribe();
    });

    // Typing indicator
    this.socket.on('chat:typing', (data: { fromUserId: number; isTyping: boolean }) => {
      this.typingUsers.update(set => {
        const newSet = new Set(set);
        if (data.isTyping) newSet.add(data.fromUserId);
        else newSet.delete(data.fromUserId);
        return newSet;
      });
    });
  }

  disconnectSocket() {
    this.socket?.disconnect();
    this.socket = null;
  }

  emitTyping(toUserId: number, isTyping: boolean) {
    this.socket?.emit('chat:typing', { toUserId, isTyping });
  }

  loadConversations() {
    return this.http.get<any>(`${environment.apiUrl}/chat/conversations`).pipe(
      tap(res => { if (res.success) this.conversations.set(res.data); })
    );
  }

  loadUnreadCount() {
    return this.http.get<any>(`${environment.apiUrl}/chat/unread-count`).pipe(
      tap(res => { if (res.success) this.unreadTotal.set(res.data.count); })
    );
  }

  loadUsers() {
    return this.http.get<any>(`${environment.apiUrl}/chat/users`).pipe(
      tap(res => { if (res.success) this.allUsers.set(res.data); })
    );
  }

  openChat(otherUserId: number) {
    this.activeConvUserId.set(otherUserId);
    this.isChatOpen.set(true);
    this.isLoadingMessages.set(true);
    this.http.get<any>(`${environment.apiUrl}/chat/conversations/${otherUserId}/messages`).pipe(
      tap(res => {
        if (res.success) {
          this.messages.set(res.data.messages);
          this.loadConversations().subscribe();
          this.loadUnreadCount().subscribe();
        }
      })
    ).subscribe({ complete: () => this.isLoadingMessages.set(false) });
  }

  sendMessage(toUserId: number, text: string) {
    return this.http.post<any>(`${environment.apiUrl}/chat/conversations/${toUserId}/messages`, { text }).pipe(
      tap(res => {
        if (res.success) {
          this.messages.update(msgs => [...msgs, res.data]);
          this.loadConversations().subscribe();
        }
      })
    );
  }

  markRead(otherUserId: number, _currentUserId: number) {
    // Trigger a GET which internally marks as read
    return this.http.get<any>(`${environment.apiUrl}/chat/conversations/${otherUserId}/messages`).pipe(
      tap(() => this.loadUnreadCount().subscribe())
    );
  }

  closeChat() {
    this.activeConvUserId.set(null);
    this.isChatOpen.set(false);
    this.messages.set([]);
  }

  getConvPartner(conv: ChatConversation, myId: number): ChatUser {
    return conv.user1Id === myId ? conv.user2 : conv.user1;
  }

  private getOtherUserId(convId: number, myId: number): number | null {
    const conv = this.conversations().find(c => c.id === convId);
    if (!conv) return null;
    return conv.user1Id === myId ? conv.user2Id : conv.user1Id;
  }
}
