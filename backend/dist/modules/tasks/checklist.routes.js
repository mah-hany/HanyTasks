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
// GET all checklist items for a task
router.get('/:taskId/checklist', async (req, res, next) => {
    try {
        const items = await client_1.default.taskChecklist.findMany({
            where: { taskId: +req.params.taskId },
            orderBy: { sortOrder: 'asc' },
        });
        res.json({ success: true, data: items });
    }
    catch (e) {
        next(e);
    }
});
// POST add a checklist item
router.post('/:taskId/checklist', async (req, res, next) => {
    try {
        const { text, textAr, sortOrder } = req.body;
        const count = await client_1.default.taskChecklist.count({ where: { taskId: +req.params.taskId } });
        const item = await client_1.default.taskChecklist.create({
            data: {
                taskId: +req.params.taskId,
                text,
                textAr,
                sortOrder: sortOrder ?? count,
            },
        });
        res.status(201).json({ success: true, data: item });
    }
    catch (e) {
        next(e);
    }
});
// PATCH toggle checklist item
router.patch('/:taskId/checklist/:itemId', async (req, res, next) => {
    try {
        const { isCompleted, text, textAr } = req.body;
        const data = {};
        if (isCompleted !== undefined) {
            data.isCompleted = isCompleted;
            data.completedAt = isCompleted ? new Date() : null;
        }
        if (text !== undefined)
            data.text = text;
        if (textAr !== undefined)
            data.textAr = textAr;
        const item = await client_1.default.taskChecklist.update({
            where: { id: +req.params.itemId },
            data,
        });
        // Auto-update task progress based on checklist completion
        const taskId = +req.params.taskId;
        const allItems = await client_1.default.taskChecklist.findMany({ where: { taskId } });
        if (allItems.length > 0) {
            const completedCount = allItems.filter(i => i.isCompleted).length;
            const progress = Math.round((completedCount / allItems.length) * 100);
            await client_1.default.task.update({
                where: { id: taskId },
                data: { progressPercent: progress },
            });
        }
        res.json({ success: true, data: item });
    }
    catch (e) {
        next(e);
    }
});
// DELETE checklist item
router.delete('/:taskId/checklist/:itemId', async (req, res, next) => {
    try {
        await client_1.default.taskChecklist.delete({ where: { id: +req.params.itemId } });
        res.json({ success: true, message: 'Deleted' });
    }
    catch (e) {
        next(e);
    }
});
// PATCH reorder checklist items
router.patch('/:taskId/checklist/reorder', async (req, res, next) => {
    try {
        const { items } = req.body;
        await Promise.all(items.map(item => client_1.default.taskChecklist.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })));
        res.json({ success: true });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=checklist.routes.js.map