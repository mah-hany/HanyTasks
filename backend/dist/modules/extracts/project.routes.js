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
// GET all projects with search
router.get('/', async (req, res, next) => {
    try {
        const { search, active } = req.query;
        const where = {};
        if (active !== 'all')
            where.isActive = true;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { nameAr: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
            ];
        }
        const data = await client_1.default.project.findMany({
            where,
            orderBy: { name: 'asc' },
            include: { _count: { select: { extracts: true } } },
        });
        res.json({ success: true, data });
    }
    catch (e) {
        next(e);
    }
});
// GET single
router.get('/:id', async (req, res, next) => {
    try {
        const data = await client_1.default.project.findUnique({
            where: { id: +req.params.id },
            include: { _count: { select: { extracts: true } } },
        });
        if (!data)
            return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    }
    catch (e) {
        next(e);
    }
});
// POST create (SUPERVISOR+)
router.post('/', async (req, res, next) => {
    try {
        if ((req.user.roleLevel ?? 99) > 4)
            return res.status(403).json({ success: false, message: 'Forbidden' });
        const { name, nameAr, code } = req.body;
        if (!name?.trim())
            return res.status(400).json({ success: false, message: 'الاسم مطلوب' });
        const data = await client_1.default.project.create({ data: { name: name.trim(), nameAr, code: code?.trim() } });
        res.status(201).json({ success: true, data });
    }
    catch (e) {
        next(e);
    }
});
// PUT update (ADMIN+)
router.put('/:id', async (req, res, next) => {
    try {
        if ((req.user.roleLevel ?? 99) > 2)
            return res.status(403).json({ success: false, message: 'Forbidden' });
        const { name, nameAr, code, isActive } = req.body;
        const data = await client_1.default.project.update({
            where: { id: +req.params.id },
            data: { name, nameAr, code, isActive },
        });
        res.json({ success: true, data });
    }
    catch (e) {
        next(e);
    }
});
// DELETE soft (ADMIN+)
router.delete('/:id', async (req, res, next) => {
    try {
        if ((req.user.roleLevel ?? 99) > 2)
            return res.status(403).json({ success: false, message: 'Forbidden' });
        await client_1.default.project.update({ where: { id: +req.params.id }, data: { isActive: false } });
        res.json({ success: true, message: 'Deactivated' });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=project.routes.js.map