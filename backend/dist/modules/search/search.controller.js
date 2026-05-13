"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchController = void 0;
const client_1 = __importDefault(require("../../prisma/client"));
exports.searchController = {
    async globalSearch(req, res, next) {
        try {
            const q = (req.query.q || '').trim().toLowerCase();
            if (!q) {
                return res.json({ success: true, data: { tasks: [], extracts: [], users: [], notifications: [] } });
            }
            // Tasks
            const tasks = await client_1.default.task.findMany({
                where: {
                    OR: [
                        { title: { contains: q, mode: 'insensitive' } },
                        { titleAr: { contains: q, mode: 'insensitive' } },
                        { taskCode: { contains: q, mode: 'insensitive' } },
                        { description: { contains: q, mode: 'insensitive' } },
                    ],
                },
                select: { id: true, title: true, titleAr: true, taskCode: true, status: true, priority: true },
                take: 10,
            });
            // Extracts
            let extractNum = parseInt(q, 10);
            const extracts = await client_1.default.taskExtract.findMany({
                where: {
                    OR: [
                        ...(isNaN(extractNum) ? [] : [{ extractNumber: extractNum }]),
                        { notes: { contains: q, mode: 'insensitive' } },
                    ]
                },
                select: { id: true, extractNumber: true, status: true, project: { select: { name: true } }, contractor: { select: { name: true } } },
                take: 10,
            });
            // Users
            const users = await client_1.default.user.findMany({
                where: {
                    OR: [
                        { fullName: { contains: q, mode: 'insensitive' } },
                        { fullNameAr: { contains: q, mode: 'insensitive' } },
                        { email: { contains: q, mode: 'insensitive' } },
                    ]
                },
                select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, role: { select: { name: true, nameAr: true } } },
                take: 10,
            });
            // Notifications
            const notifications = await client_1.default.notification.findMany({
                where: {
                    receiverId: req.user.id,
                    OR: [
                        { title: { contains: q, mode: 'insensitive' } },
                        { titleAr: { contains: q, mode: 'insensitive' } },
                        { message: { contains: q, mode: 'insensitive' } },
                        { messageAr: { contains: q, mode: 'insensitive' } },
                    ]
                },
                select: { id: true, title: true, titleAr: true, message: true, messageAr: true, isRead: true, createdAt: true },
                take: 10,
            });
            res.json({
                success: true,
                data: { tasks, extracts, users, notifications }
            });
        }
        catch (e) {
            next(e);
        }
    }
};
//# sourceMappingURL=search.controller.js.map