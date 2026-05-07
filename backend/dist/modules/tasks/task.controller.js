"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskController = exports.uploadAttachment = void 0;
const task_service_1 = require("./task.service");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const client_1 = __importDefault(require("../../prisma/client"));
const uploadDir = path_1.default.join(process.cwd(), 'uploads', 'attachments');
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
exports.uploadAttachment = (0, multer_1.default)({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
exports.taskController = {
    async getAll(req, res, next) {
        try {
            const data = await task_service_1.taskService.getAll({
                ...req.query,
                userId: req.user.id,
                userRoleLevel: req.user.roleLevel,
            });
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async getById(req, res, next) {
        try {
            const task = await task_service_1.taskService.getById(+req.params.id);
            const checklist = await client_1.default.taskChecklist.findMany({
                where: { taskId: +req.params.id },
                orderBy: { sortOrder: 'asc' },
            });
            res.json({ success: true, data: { ...task, checklist } });
        }
        catch (e) {
            next(e);
        }
    },
    async create(req, res, next) {
        try {
            const data = await task_service_1.taskService.create({ ...req.body, createdById: req.user.id });
            // If created from template, clone checklist items
            if (req.body.templateId) {
                const template = await client_1.default.taskTemplate.findUnique({ where: { id: +req.body.templateId } });
                if (template?.checklistItems) {
                    const items = JSON.parse(template.checklistItems);
                    await Promise.all(items.map((item, idx) => client_1.default.taskChecklist.create({
                        data: { taskId: data.id, text: item.text, textAr: item.textAr, sortOrder: idx },
                    })));
                }
            }
            res.status(201).json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async updateStatus(req, res, next) {
        try {
            const { status, note } = req.body;
            const data = await task_service_1.taskService.updateStatus(+req.params.id, status, req.user.id, note);
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async updateProgress(req, res, next) {
        try {
            const data = await task_service_1.taskService.updateProgress(+req.params.id, +req.body.progress, req.user.id);
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async addComment(req, res, next) {
        try {
            const data = await task_service_1.taskService.addComment(+req.params.id, req.user.id, req.body.text, req.body.isManagerNote);
            res.status(201).json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async addAttachment(req, res, next) {
        try {
            if (!req.file)
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            const att = await client_1.default.taskAttachment.create({
                data: {
                    taskId: +req.params.id,
                    fileName: req.file.originalname,
                    fileUrl: `/uploads/attachments/${req.file.filename}`,
                    fileSize: req.file.size,
                    fileType: req.file.mimetype,
                    uploadedById: req.user.id,
                },
            });
            res.status(201).json({ success: true, data: att });
        }
        catch (e) {
            next(e);
        }
    },
    async getDashboard(req, res, next) {
        try {
            const data = await task_service_1.taskService.getDashboardStats(req.user.id, req.user.roleLevel);
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    // ── Calendar View ────────────────────────────────────────────
    async getCalendar(req, res, next) {
        try {
            const { year, month } = req.query;
            const now = new Date();
            const y = year ? +year : now.getFullYear();
            const m = month ? +month - 1 : now.getMonth();
            const from = new Date(y, m, 1);
            const to = new Date(y, m + 1, 0, 23, 59, 59);
            const where = {
                OR: [
                    { dueDate: { gte: from, lte: to } },
                    { startDate: { gte: from, lte: to } },
                ],
            };
            // Restrict by hierarchy
            if (req.user.roleLevel > 1) {
                const users = await client_1.default.user.findMany({ select: { id: true, managerId: true } });
                const childrenMap = new Map();
                for (const u of users) {
                    if (u.managerId) {
                        if (!childrenMap.has(u.managerId))
                            childrenMap.set(u.managerId, []);
                        childrenMap.get(u.managerId).push(u.id);
                    }
                }
                const subIds = [];
                const queue = [req.user.id];
                while (queue.length > 0) {
                    const cur = queue.shift();
                    const children = childrenMap.get(cur) || [];
                    subIds.push(...children);
                    queue.push(...children);
                }
                where.assignedToId = { in: [req.user.id, ...subIds] };
            }
            const tasks = await client_1.default.task.findMany({
                where,
                include: {
                    assignedTo: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } },
                    category: true,
                },
                orderBy: { dueDate: 'asc' },
            });
            res.json({ success: true, data: tasks });
        }
        catch (e) {
            next(e);
        }
    },
    async getCategories(_req, res, next) {
        try {
            const data = await client_1.default.taskCategory.findMany({ orderBy: { name: 'asc' } });
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async delete(req, res, next) {
        try {
            const data = await task_service_1.taskService.delete(+req.params.id);
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
};
//# sourceMappingURL=task.controller.js.map