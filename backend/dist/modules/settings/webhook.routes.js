"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = __importDefault(require("../../prisma/client"));
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, (0, auth_1.authorizeLevel)(1)); // SuperAdmin only
router.get('/', async (req, res, next) => {
    try {
        const hooks = await client_1.default.webhook.findMany({ orderBy: { createdAt: 'desc' } });
        res.json({ success: true, data: hooks });
    }
    catch (e) {
        next(e);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const { name, url, eventTypes, secret, isActive } = req.body;
        const user = req.user;
        const hook = await client_1.default.webhook.create({
            data: { name, url, eventTypes, secret, isActive, createdById: user.id }
        });
        res.status(201).json({ success: true, data: hook });
    }
    catch (e) {
        next(e);
    }
});
router.put('/:id', async (req, res, next) => {
    try {
        const { name, url, eventTypes, secret, isActive } = req.body;
        const hook = await client_1.default.webhook.update({
            where: { id: +req.params.id },
            data: { name, url, eventTypes, secret, isActive }
        });
        res.json({ success: true, data: hook });
    }
    catch (e) {
        next(e);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        await client_1.default.webhook.delete({ where: { id: +req.params.id } });
        res.json({ success: true, message: 'Webhook deleted' });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map