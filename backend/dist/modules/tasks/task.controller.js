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
            res.json({ success: true, data: await task_service_1.taskService.getById(+req.params.id) });
        }
        catch (e) {
            next(e);
        }
    },
    async create(req, res, next) {
        try {
            const data = await task_service_1.taskService.create({ ...req.body, createdById: req.user.id });
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