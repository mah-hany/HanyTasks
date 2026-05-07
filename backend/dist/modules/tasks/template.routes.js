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
// GET all templates (global + own)
router.get('/', async (req, res, next) => {
    try {
        const templates = await client_1.default.taskTemplate.findMany({
            where: {
                OR: [
                    { isGlobal: true },
                    { createdById: req.user.id },
                ],
            },
            orderBy: [{ isGlobal: 'desc' }, { createdAt: 'desc' }],
        });
        res.json({ success: true, data: templates });
    }
    catch (e) {
        next(e);
    }
});
// GET single template
router.get('/:id', async (req, res, next) => {
    try {
        const template = await client_1.default.taskTemplate.findUnique({ where: { id: +req.params.id } });
        if (!template)
            return res.status(404).json({ success: false, message: 'Template not found' });
        res.json({ success: true, data: template });
    }
    catch (e) {
        next(e);
    }
});
// POST create template
router.post('/', async (req, res, next) => {
    try {
        const { name, nameAr, description, categoryId, priority, defaultDuration, checklistItems, isGlobal } = req.body;
        const template = await client_1.default.taskTemplate.create({
            data: {
                name,
                nameAr,
                description,
                categoryId: categoryId ? +categoryId : null,
                priority: priority || 'MEDIUM',
                defaultDuration: defaultDuration ? +defaultDuration : null,
                checklistItems: checklistItems ? JSON.stringify(checklistItems) : null,
                isGlobal: isGlobal && req.user.roleLevel <= 2 ? true : false,
                createdById: req.user.id,
            },
        });
        res.status(201).json({ success: true, data: template });
    }
    catch (e) {
        next(e);
    }
});
// PUT update template
router.put('/:id', async (req, res, next) => {
    try {
        const { name, nameAr, description, categoryId, priority, defaultDuration, checklistItems, isGlobal } = req.body;
        const template = await client_1.default.taskTemplate.update({
            where: { id: +req.params.id },
            data: {
                name,
                nameAr,
                description,
                categoryId: categoryId ? +categoryId : null,
                priority,
                defaultDuration: defaultDuration ? +defaultDuration : null,
                checklistItems: checklistItems ? JSON.stringify(checklistItems) : null,
                isGlobal: isGlobal && req.user.roleLevel <= 2 ? true : false,
            },
        });
        res.json({ success: true, data: template });
    }
    catch (e) {
        next(e);
    }
});
// DELETE template
router.delete('/:id', async (req, res, next) => {
    try {
        await client_1.default.taskTemplate.delete({ where: { id: +req.params.id } });
        res.json({ success: true, message: 'Template deleted' });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=template.routes.js.map