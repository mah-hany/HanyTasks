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
router.use((0, auth_1.authorizeLevel)(1)); // SuperAdmin only
router.get('/', async (_req, res, next) => {
    try {
        const settings = await client_1.default.systemSetting.findMany();
        const map = {};
        settings.forEach(s => { map[s.key] = s.value; });
        res.json({ success: true, data: map });
    }
    catch (e) {
        next(e);
    }
});
router.put('/:key', async (req, res, next) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        const setting = await client_1.default.systemSetting.upsert({
            where: { key }, update: { value }, create: { key, value },
        });
        res.json({ success: true, data: setting });
    }
    catch (e) {
        next(e);
    }
});
router.get('/roles/permissions', async (_req, res, next) => {
    try {
        const roles = await client_1.default.role.findMany({
            include: { permissions: true }
        });
        res.json({ success: true, data: roles });
    }
    catch (e) {
        next(e);
    }
});
router.put('/roles/:roleId/permissions/:moduleId', async (req, res, next) => {
    try {
        const roleId = parseInt(req.params.roleId);
        const moduleId = parseInt(req.params.moduleId);
        const data = req.body; // { canRead, canCreate, canUpdate, canDelete, etc }
        const perm = await client_1.default.permission.update({
            where: { id: moduleId },
            data: {
                canCreate: data.canCreate,
                canRead: data.canRead,
                canUpdate: data.canUpdate,
                canDelete: data.canDelete,
                canAssign: data.canAssign,
                canReport: data.canReport
            }
        });
        res.json({ success: true, data: perm });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=settings.routes.js.map