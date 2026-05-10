import { Request, Response } from 'express';
import prisma from '../../prisma/client';
import { getSocketIO, userSocketMap } from '../../socket';

// GET /api/chat/conversations — list all conversations for the current user
export async function getConversations(req: Request, res: Response) {
  const userId = (req as any).user.id;

  const convs = await prisma.chatConversation.findMany({
    where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    include: {
      user1: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, isActive: true } },
      user2: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, isActive: true } },
    },
    orderBy: { lastAt: 'desc' },
  });

  // Count unread per conversation
  const withUnread = await Promise.all(
    convs.map(async (conv) => {
      const unread = await prisma.chatMessage.count({
        where: { conversationId: conv.id, isRead: false, senderId: { not: userId } },
      });
      return { ...conv, unreadCount: unread };
    })
  );

  res.json({ success: true, data: withUnread });
}

// GET /api/chat/conversations/:otherId/messages — messages with a specific user
export async function getMessages(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const otherId = +req.params.otherId;
  const page = +(req.query['page'] || 1);
  const limit = 50;

  // Find or create conversation
  let conv = await prisma.chatConversation.findFirst({
    where: {
      OR: [
        { user1Id: userId, user2Id: otherId },
        { user1Id: otherId, user2Id: userId },
      ],
    },
  });

  if (!conv) {
    conv = await prisma.chatConversation.create({
      data: { user1Id: Math.min(userId, otherId), user2Id: Math.max(userId, otherId) },
    });
  }

  // Mark received messages as read
  await prisma.chatMessage.updateMany({
    where: { conversationId: conv.id, senderId: otherId, isRead: false },
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

// POST /api/chat/conversations/:otherId/messages — send a message
export async function sendMessage(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const otherId = +req.params.otherId;
  const { text } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ success: false, message: 'Message text is required' });
  }

  // Find or create conversation (always store with lower userId as user1)
  const u1 = Math.min(userId, otherId);
  const u2 = Math.max(userId, otherId);

  const conv = await prisma.chatConversation.upsert({
    where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    create: { user1Id: u1, user2Id: u2, lastMessage: text.trim(), lastAt: new Date() },
    update: { lastMessage: text.trim(), lastAt: new Date() },
  });

  const message = await prisma.chatMessage.create({
    data: { conversationId: conv.id, senderId: userId, text: text.trim() },
    include: { sender: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } } },
  });

  // Emit via Socket.IO to the other user's room
  try {
    const io = getSocketIO();
    const otherSocketId = userSocketMap.get(otherId);
    if (otherSocketId && io) {
      io.to(otherSocketId).emit('chat:message', { conversationId: conv.id, message });
    }
    // Also emit back to sender (for multi-tab sync)
    const senderSocketId = userSocketMap.get(userId);
    if (senderSocketId && io) {
      io.to(senderSocketId).emit('chat:message:sent', { conversationId: conv.id, message });
    }
  } catch (_) {}

  res.json({ success: true, data: message });
}

// GET /api/chat/users — list all users to start a chat with
export async function getChatUsers(req: Request, res: Response) {
  const userId = (req as any).user.id;

  const users = await prisma.user.findMany({
    where: { isActive: true, id: { not: userId } },
    select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, role: { select: { nameAr: true, name: true } } },
    orderBy: { fullName: 'asc' },
  });

  res.json({ success: true, data: users });
}

// GET /api/chat/unread-count — total unread messages
export async function getUnreadCount(req: Request, res: Response) {
  const userId = (req as any).user.id;

  const count = await prisma.chatMessage.count({
    where: { isRead: false, senderId: { not: userId }, conversation: { OR: [{ user1Id: userId }, { user2Id: userId }] } },
  });

  res.json({ success: true, data: { count } });
}
