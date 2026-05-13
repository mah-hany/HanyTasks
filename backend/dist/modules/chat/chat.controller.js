"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConversations = getConversations;
exports.getMessages = getMessages;
exports.sendMessage = sendMessage;
exports.getChatUsers = getChatUsers;
exports.getUnreadCount = getUnreadCount;
exports.createGroup = createGroup;
exports.getGroupMessages = getGroupMessages;
exports.sendGroupMessage = sendGroupMessage;
const client_1 = __importDefault(require("../../prisma/client"));
const socket_1 = require("../../socket");
// GET /api/chat/conversations — list all conversations for the current user
async function getConversations(req, res) {
    const userId = req.user.id;
    const convs = await client_1.default.chatConversation.findMany({
        where: { OR: [{ user1Id: userId }, { user2Id: userId }, { participants: { some: { userId } } }] },
        include: {
            user1: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, isActive: true } },
            user2: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, isActive: true } },
            participants: { include: { user: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, isActive: true } } } },
        },
        orderBy: { lastAt: 'desc' },
    });
    // Count unread per conversation
    const withUnread = await Promise.all(convs.map(async (conv) => {
        const unread = await client_1.default.chatMessage.count({
            where: { conversationId: conv.id, isRead: false, senderId: { not: userId } },
        });
        return { ...conv, unreadCount: unread };
    }));
    res.json({ success: true, data: withUnread });
}
// GET /api/chat/conversations/:otherId/messages — messages with a specific user
async function getMessages(req, res) {
    const userId = req.user.id;
    const otherId = +req.params.otherId;
    const page = +(req.query['page'] || 1);
    const limit = 50;
    // Find or create conversation
    let conv = await client_1.default.chatConversation.findFirst({
        where: {
            OR: [
                { user1Id: userId, user2Id: otherId },
                { user1Id: otherId, user2Id: userId },
            ],
        },
    });
    if (!conv) {
        conv = await client_1.default.chatConversation.create({
            data: { user1Id: Math.min(userId, otherId), user2Id: Math.max(userId, otherId) },
        });
    }
    // Mark received messages as read
    await client_1.default.chatMessage.updateMany({
        where: { conversationId: conv.id, senderId: otherId, isRead: false },
        data: { isRead: true },
    });
    const messages = await client_1.default.chatMessage.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { sender: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } } },
    });
    res.json({ success: true, data: { conversationId: conv.id, messages: messages.reverse() } });
}
// POST /api/chat/conversations/:otherId/messages — send a message
async function sendMessage(req, res) {
    const userId = req.user.id;
    const otherId = +req.params.otherId;
    const { text } = req.body;
    if (!text?.trim()) {
        return res.status(400).json({ success: false, message: 'Message text is required' });
    }
    // Find or create conversation (always store with lower userId as user1)
    const u1 = Math.min(userId, otherId);
    const u2 = Math.max(userId, otherId);
    const conv = await client_1.default.chatConversation.upsert({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        create: { user1Id: u1, user2Id: u2, lastMessage: text.trim(), lastAt: new Date() },
        update: { lastMessage: text.trim(), lastAt: new Date() },
    });
    const message = await client_1.default.chatMessage.create({
        data: { conversationId: conv.id, senderId: userId, text: text.trim() },
        include: { sender: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } } },
    });
    // Emit via Socket.IO to the other user's room
    try {
        const io = (0, socket_1.getSocketIO)();
        const otherSocketId = socket_1.userSocketMap.get(otherId);
        if (otherSocketId && io) {
            io.to(otherSocketId).emit('chat:message', { conversationId: conv.id, message });
        }
        // Also emit back to sender (for multi-tab sync)
        const senderSocketId = socket_1.userSocketMap.get(userId);
        if (senderSocketId && io) {
            io.to(senderSocketId).emit('chat:message:sent', { conversationId: conv.id, message });
        }
    }
    catch (_) { }
    res.json({ success: true, data: message });
}
// GET /api/chat/users — list all users to start a chat with
async function getChatUsers(req, res) {
    const userId = req.user.id;
    const users = await client_1.default.user.findMany({
        where: { isActive: true, id: { not: userId } },
        select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, role: { select: { nameAr: true, name: true } } },
        orderBy: { fullName: 'asc' },
    });
    res.json({ success: true, data: users });
}
// GET /api/chat/unread-count — total unread messages
async function getUnreadCount(req, res) {
    const userId = req.user.id;
    const count = await client_1.default.chatMessage.count({
        where: {
            isRead: false,
            senderId: { not: userId },
            conversation: { OR: [{ user1Id: userId }, { user2Id: userId }, { participants: { some: { userId } } }] }
        },
    });
    res.json({ success: true, data: { count } });
}
// POST /api/chat/groups — Create a group chat
async function createGroup(req, res) {
    const userId = req.user.id;
    const { name, userIds } = req.body;
    if (!name || !userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ success: false, message: 'Group name and userIds are required' });
    }
    const allUserIds = Array.from(new Set([userId, ...userIds]));
    const conv = await client_1.default.chatConversation.create({
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
    const io = (0, socket_1.getSocketIO)();
    allUserIds.forEach((id) => {
        if (id !== userId) {
            const sid = socket_1.userSocketMap.get(id);
            if (sid && io)
                io.to(sid).emit('chat:group:created', conv);
        }
    });
    res.json({ success: true, data: conv });
}
// GET /api/chat/groups/:groupId/messages
async function getGroupMessages(req, res) {
    const userId = req.user.id;
    const groupId = +req.params.groupId;
    const page = +(req.query['page'] || 1);
    const limit = 50;
    const conv = await client_1.default.chatConversation.findFirst({
        where: { id: groupId, isGroup: true, participants: { some: { userId } } },
    });
    if (!conv) {
        return res.status(404).json({ success: false, message: 'Group not found or access denied' });
    }
    // Mark received messages as read
    await client_1.default.chatMessage.updateMany({
        where: { conversationId: conv.id, isRead: false, senderId: { not: userId } },
        data: { isRead: true },
    });
    const messages = await client_1.default.chatMessage.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { sender: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } } },
    });
    res.json({ success: true, data: { conversationId: conv.id, messages: messages.reverse() } });
}
// POST /api/chat/groups/:groupId/messages
async function sendGroupMessage(req, res) {
    const userId = req.user.id;
    const groupId = +req.params.groupId;
    const { text } = req.body;
    if (!text?.trim()) {
        return res.status(400).json({ success: false, message: 'Message text is required' });
    }
    const conv = await client_1.default.chatConversation.findFirst({
        where: { id: groupId, isGroup: true, participants: { some: { userId } } },
        include: { participants: true },
    });
    if (!conv) {
        return res.status(404).json({ success: false, message: 'Group not found or access denied' });
    }
    const updatedConv = await client_1.default.chatConversation.update({
        where: { id: conv.id },
        data: { lastMessage: text.trim(), lastAt: new Date() },
    });
    const message = await client_1.default.chatMessage.create({
        data: { conversationId: conv.id, senderId: userId, text: text.trim() },
        include: { sender: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } } },
    });
    const io = (0, socket_1.getSocketIO)();
    conv.participants.forEach((p) => {
        if (p.userId !== userId) {
            const sid = socket_1.userSocketMap.get(p.userId);
            if (sid && io)
                io.to(sid).emit('chat:message', { conversationId: conv.id, message });
        }
        else {
            const sid = socket_1.userSocketMap.get(userId);
            if (sid && io)
                io.to(sid).emit('chat:message:sent', { conversationId: conv.id, message });
        }
    });
    res.json({ success: true, data: message });
}
//# sourceMappingURL=chat.controller.js.map