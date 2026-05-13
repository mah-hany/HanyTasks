import sys

path = r'src/app/core/services/chat.service.ts'
with open(path, encoding='utf-8') as f:
    content = f.read()

old_interface = """export interface ChatConversation {
  id: number;
  user1Id: number;
  user2Id: number;
  lastMessage?: string;
  lastAt?: string;
  unreadCount: number;
  user1: ChatUser;
  user2: ChatUser;
}"""

new_interface = """export interface ChatParticipant {
  id: number;
  userId: number;
  user: ChatUser;
}

export interface ChatConversation {
  id: number;
  isGroup?: boolean;
  groupName?: string;
  user1Id?: number;
  user2Id?: number;
  lastMessage?: string;
  lastAt?: string;
  unreadCount: number;
  user1?: ChatUser;
  user2?: ChatUser;
  participants?: ChatParticipant[];
}"""

content = content.replace(old_interface, new_interface)
if old_interface.replace('\n', '\r\n') in content:
    content = content.replace(old_interface.replace('\n', '\r\n'), new_interface)

old_open = """  openChat(otherUserId: number) {
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
  }"""

new_open = """  openChat(otherUserId: number) {
    this.activeConvUserId.set(otherUserId);
    this.isChatOpen.set(true);
    this.isLoadingMessages.set(true);
    
    const url = otherUserId < 0 
      ? `${environment.apiUrl}/chat/groups/${-otherUserId}/messages`
      : `${environment.apiUrl}/chat/conversations/${otherUserId}/messages`;
      
    this.http.get<any>(url).pipe(
      tap(res => {
        if (res.success) {
          this.messages.set(res.data.messages);
          this.loadConversations().subscribe();
          this.loadUnreadCount().subscribe();
        }
      })
    ).subscribe({ complete: () => this.isLoadingMessages.set(false) });
  }"""

content = content.replace(old_open, new_open)
if old_open.replace('\n', '\r\n') in content:
    content = content.replace(old_open.replace('\n', '\r\n'), new_open)

old_send = """  sendMessage(toUserId: number, text: string) {
    return this.http.post<any>(`${environment.apiUrl}/chat/conversations/${toUserId}/messages`, { text }).pipe(
      tap(res => {
        if (res.success) {
          this.messages.update(msgs => [...msgs, res.data]);
          this.loadConversations().subscribe();
        }
      })
    );
  }"""

new_send = """  sendMessage(toUserId: number, text: string) {
    const url = toUserId < 0 
      ? `${environment.apiUrl}/chat/groups/${-toUserId}/messages`
      : `${environment.apiUrl}/chat/conversations/${toUserId}/messages`;
      
    return this.http.post<any>(url, { text }).pipe(
      tap(res => {
        if (res.success) {
          this.messages.update(msgs => [...msgs, res.data]);
          this.loadConversations().subscribe();
        }
      })
    );
  }"""

content = content.replace(old_send, new_send)
if old_send.replace('\n', '\r\n') in content:
    content = content.replace(old_send.replace('\n', '\r\n'), new_send)

old_mark = """  markRead(otherUserId: number, _currentUserId: number) {
    // Trigger a GET which internally marks as read
    return this.http.get<any>(`${environment.apiUrl}/chat/conversations/${otherUserId}/messages`).pipe(
      tap(() => this.loadUnreadCount().subscribe())
    );
  }"""

new_mark = """  markRead(otherUserId: number, _currentUserId: number) {
    const url = otherUserId < 0 
      ? `${environment.apiUrl}/chat/groups/${-otherUserId}/messages`
      : `${environment.apiUrl}/chat/conversations/${otherUserId}/messages`;
    return this.http.get<any>(url).pipe(
      tap(() => this.loadUnreadCount().subscribe())
    );
  }"""

content = content.replace(old_mark, new_mark)
if old_mark.replace('\n', '\r\n') in content:
    content = content.replace(old_mark.replace('\n', '\r\n'), new_mark)

old_partner = """  getConvPartner(conv: ChatConversation, myId: number): ChatUser {
    return conv.user1Id === myId ? conv.user2 : conv.user1;
  }"""

new_partner = """  getConvPartner(conv: ChatConversation, myId: number): ChatUser {
    if (conv.isGroup) {
      return { id: -conv.id, fullName: conv.groupName || 'مجموعة', fullNameAr: conv.groupName || 'مجموعة', profilePhoto: '' } as ChatUser;
    }
    return conv.user1Id === myId ? conv.user2! : conv.user1!;
  }"""

content = content.replace(old_partner, new_partner)
if old_partner.replace('\n', '\r\n') in content:
    content = content.replace(old_partner.replace('\n', '\r\n'), new_partner)

old_other = """  private getOtherUserId(convId: number, myId: number): number | null {
    const conv = this.conversations().find(c => c.id === convId);
    if (!conv) return null;
    return conv.user1Id === myId ? conv.user2Id : conv.user1Id;
  }"""

new_other = """  private getOtherUserId(convId: number, myId: number): number | null {
    const conv = this.conversations().find(c => c.id === convId);
    if (!conv) return null;
    if (conv.isGroup) return -conv.id;
    return conv.user1Id === myId ? conv.user2Id! : conv.user1Id!;
  }"""

content = content.replace(old_other, new_other)
if old_other.replace('\n', '\r\n') in content:
    content = content.replace(old_other.replace('\n', '\r\n'), new_other)

# Also add createGroup method
group_create = """
  createGroup(name: string, userIds: number[]) {
    return this.http.post<any>(`${environment.apiUrl}/chat/groups`, { name, userIds }).pipe(
      tap(res => {
        if (res.success) {
          this.loadConversations().subscribe();
        }
      })
    );
  }
"""
content += group_create

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("SUCCESS")
