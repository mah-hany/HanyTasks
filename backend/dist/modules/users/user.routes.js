"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const auth_1 = require("../../middleware/auth");
const client_1 = __importDefault(require("../../prisma/client"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// ── All authenticated users: list assignable employees (for task form dropdown) ──
router.get('/assignable', async (_req, res, next) => {
    try {
        const users = await client_1.default.user.findMany({
            where: { isActive: true },
            select: {
                id: true,
                fullName: true,
                fullNameAr: true,
                employeeCode: true,
                profilePhoto: true,
                department: { select: { name: true, nameAr: true } },
            },
            orderBy: { fullNameAr: 'asc' },
        });
        res.json({ success: true, data: users });
    }
    catch (e) {
        next(e);
    }
});
router.get('/org-tree', user_controller_1.userController.getOrgTree);
router.get('/', (0, auth_1.authorizeLevel)(2), user_controller_1.userController.getAll);
router.get('/:id', user_controller_1.userController.getById);
router.post('/', (0, auth_1.authorizeLevel)(2), user_controller_1.userController.create);
router.put('/:id', (0, auth_1.authorizeLevel)(2), user_controller_1.userController.update);
router.post('/:id/reset-password', (0, auth_1.authorizeLevel)(2), user_controller_1.userController.resetPassword);
router.post('/:id/transfer', (0, auth_1.authorizeLevel)(2), user_controller_1.userController.transfer);
router.post('/:id/photo', user_controller_1.uploadAvatar.single('photo'), user_controller_1.userController.uploadPhoto);
router.delete('/:id', (0, auth_1.authorizeLevel)(1), user_controller_1.userController.delete);
exports.default = router;
//# sourceMappingURL=user.routes.js.map