"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const client_1 = __importDefault(require("../../prisma/client"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// ── Get active timer for current user (MUST be before /:taskId) ─
router.get('/active/me', async (req, res, next) => {
    try {
        const active = await client_1.default.timeEntry.findFirst({
            where: { userId: req.user.id, endTime: null },
            include: { task: { select: { id: true, taskCode: true, title: true, titleAr: true } } },
        });
        res.json({ success: true, data: active });
    }
    catch (e) {
        next(e);
    }
});
// ── Get time report per user (MUST be before /:taskId) ──────
router.get('/report/user/:userId', async (req, res, next) => {
    try {
        const entries = await client_1.default.timeEntry.findMany({
            where: { userId: +req.params.userId, endTime: { not: null } },
            include: { task: { select: { id: true, taskCode: true, title: true, titleAr: true } } },
            orderBy: { startTime: 'desc' },
        });
        const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
        const byTask = entries.reduce((acc, e) => {
            const key = e.task.taskCode;
            if (!acc[key])
                acc[key] = { task: e.task, minutes: 0 };
            acc[key].minutes += e.duration || 0;
            return acc;
        }, {});
        res.json({ success: true, data: { entries, totalMinutes, byTask: Object.values(byTask) } });
    }
    catch (e) {
        next(e);
    }
});
// ── Start timer ──────────────────────────────────────────────
router.post('/:taskId/start', async (req, res, next) => {
    try {
        // Stop any active timer for this user first
        await client_1.default.timeEntry.updateMany({
            where: { userId: req.user.id, endTime: null },
            data: { endTime: new Date(), duration: 0 },
        });
        const entry = await client_1.default.timeEntry.create({
            data: {
                taskId: +req.params.taskId,
                userId: req.user.id,
                startTime: new Date(),
                note: req.body.note,
            },
        });
        res.status(201).json({ success: true, data: entry });
    }
    catch (e) {
        next(e);
    }
});
// ── Stop timer ───────────────────────────────────────────────
router.post('/:taskId/stop', async (req, res, next) => {
    try {
        const active = await client_1.default.timeEntry.findFirst({
            where: { taskId: +req.params.taskId, userId: req.user.id, endTime: null },
            orderBy: { startTime: 'desc' },
        });
        if (!active)
            return res.status(404).json({ success: false, message: 'No active timer' });
        const endTime = new Date();
        const duration = Math.round((endTime.getTime() - active.startTime.getTime()) / 60000); // minutes
        const updated = await client_1.default.timeEntry.update({
            where: { id: active.id },
            data: { endTime, duration },
        });
        res.json({ success: true, data: updated });
    }
    catch (e) {
        next(e);
    }
});
// ── Get time entries for a task ──────────────────────────────
router.get('/:taskId', async (req, res, next) => {
    try {
        const entries = await client_1.default.timeEntry.findMany({
            where: { taskId: +req.params.taskId },
            include: { user: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } } },
            orderBy: { startTime: 'desc' },
        });
        const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
        res.json({ success: true, data: entries, totalMinutes });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=time.routes.js.map