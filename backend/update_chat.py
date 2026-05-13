import sys

path = r'src/modules/chat/chat.controller.ts'
with open(path, encoding='utf-8') as f:
    content = f.read()

# Update getConversations
old_conv = """  const convs = await prisma.chatConversation.findMany({
    where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    include: {
      user1: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, isActive: true } },
      user2: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, isActive: true } },
    },
    orderBy: { lastAt: 'desc' },
  });"""

new_conv = """  const convs = await prisma.chatConversation.findMany({
    where: { OR: [{ user1Id: userId }, { user2Id: userId }, { participants: { some: { userId } } }] },
    include: {
      user1: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, isActive: true } },
      user2: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, isActive: true } },
      participants: { include: { user: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, isActive: true } } } },
    },
    orderBy: { lastAt: 'desc' },
  });"""

content = content.replace(old_conv, new_conv)
if old_conv.replace('\n', '\r\n') in content:
    content = content.replace(old_conv.replace('\n', '\r\n'), new_conv)

# Update getUnreadCount
old_unread = """  const count = await prisma.chatMessage.count({
    where: { isRead: false, senderId: { not: userId }, conversation: { OR: [{ user1Id: userId }, { user2Id: userId }] } },
  });"""

new_unread = """  const count = await prisma.chatMessage.count({
    where: { 
      isRead: false, 
      senderId: { not: userId }, 
      conversation: { OR: [{ user1Id: userId }, { user2Id: userId }, { participants: { some: { userId } } }] } 
    },
  });"""

content = content.replace(old_unread, new_unread)
if old_unread.replace('\n', '\r\n') in content:
    content = content.replace(old_unread.replace('\n', '\r\n'), new_unread)

# Add group functions at the end
group_funcs = """
// POST /api/chat/groups — Create a group chat
export async function createGroup(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const { name, userIds } = req.body;

  if (!name || !userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ success: false, message: 'Group name and userIds are required' });
  }

  const allUserIds = Array.from(new Set([userId, ...userIds]));

  const conv = await prisma.chatConversation.create({
    data: {
      isGroup: true,
      groupName: name,
      createdById: userId,
      lastAt: new Date(),
      participants: {
        create: allUserIds.map((id) => ({ userId: id })),
      },
    },
    include: {
      participants: { include: { user: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } } } }
    }
  });

  // Notify other members
  const io = getSocketIO();
  allUserIds.forEach((id) => {
    if (id !== userId) {
      const sid = userSocketMap.get(id);
      if (sid && io) io.to(sid).emit('chat:group:created', conv);
    }
  });

  res.json({ success: true, data: conv });
}

// GET /api/chat/groups/:groupId/messages
export async function getGroupMessages(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const groupId = +req.params.groupId;
  const page = +(req.query['page'] || 1);
  const limit = 50;

  const conv = await prisma.chatConversation.findFirst({
    where: { id: groupId, isGroup: true, participants: { some: { userId } } },
  });

  if (!conv) {
    return res.status(404).json({ success: false, message: 'Group not found or access denied' });
  }

  // Mark received messages as read
  await prisma.chatMessage.updateMany({
    where: { conversationId: conv.id, isRead: false, senderId: { not: userId } },
    data: { isRead: true },
  });

  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
    include: { sender: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } } },
  });

  res.json({ success: true, data: { conversationId: conv.id, messages: messages.reverse() } });
}

// POST /api/chat/groups/:groupId/messages
export async function sendGroupMessage(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const groupId = +req.params.groupId;
  const { text } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ success: false, message: 'Message text is required' });
  }

  const conv = await prisma.chatConversation.findFirst({
    where: { id: groupId, isGroup: true, participants: { some: { userId } } },
    include: { participants: true },
  });

  if (!conv) {
    return res.status(404).json({ success: false, message: 'Group not found or access denied' });
  }

  const updatedConv = await prisma.chatConversation.update({
    where: { id: conv.id },
    data: { lastMessage: text.trim(), lastAt: new Date() },
  });

  const message = await prisma.chatMessage.create({
    data: { conversationId: conv.id, senderId: userId, text: text.trim() },
    include: { sender: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } } },
  });

  const io = getSocketIO();
  conv.participants.forEach((p) => {
    if (p.userId !== userId) {
      const sid = userSocketMap.get(p.userId);
      if (sid && io) io.to(sid).emit('chat:message', { conversationId: conv.id, message });
    } else {
      const sid = userSocketMap.get(userId);
      if (sid && io) io.to(sid).emit('chat:message:sent', { conversationId: conv.id, message });
    }
  });

  res.json({ success: true, data: message });
}
"""

with open(path, 'w', encoding='utf-8') as f:
    f.write(content + group_funcs)

print("SUCCESS")
