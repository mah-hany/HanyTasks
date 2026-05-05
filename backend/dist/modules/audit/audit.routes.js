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
router.use((0, auth_1.authorizeLevel)(3));
router.get('/', async (_req, res, next) => {
    try {
        const logs = await client_1.default.auditLog.findMany({
            include: { user: { select: { fullName: true, fullNameAr: true, username: true } } },
            orderBy: { actionDate: 'desc' },
            take: 200,
        });
        res.json({ success: true, data: logs });
    }
    catch (e) {
        next(e);
    }
});
router.delete('/', (0, auth_1.authorizeLevel)(1), async (req, res, next) => {
    try {
        const { type } = req.query; // 'all' or 'old'
        let count;
        if (type === 'old') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            count = await client_1.default.auditLog.deleteMany({
                where: { actionDate: { lt: thirtyDaysAgo } }
            });
        }
        else {
            count = await client_1.default.auditLog.deleteMany({});
        }
        await client_1.default.auditLog.create({
            data: { action: type === 'old' ? 'DELETE_OLD_AUDIT' : 'CLEAR_AUDIT', tableAffected: 'tbl_AuditLog', userId: req.user.id },
        });
        res.json({ success: true, message: `Deleted ${count.count} records.` });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=audit.routes.js.map