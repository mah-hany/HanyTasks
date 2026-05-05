"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const notification_service_1 = require("./notification.service");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', async (req, res, next) => {
    try {
        const unreadOnly = req.query.unread === 'true';
        const data = await notification_service_1.notificationService.getForUser(req.user.id, unreadOnly);
        res.json({ success: true, data });
    }
    catch (e) {
        next(e);
    }
});
router.get('/unread-count', async (req, res, next) => {
    try {
        const count = await notification_service_1.notificationService.getUnreadCount(req.user.id);
        res.json({ success: true, data: { count } });
    }
    catch (e) {
        next(e);
    }
});
router.patch('/:id/read', async (req, res, next) => {
    try {
        const data = await notification_service_1.notificationService.markRead(+req.params.id, req.user.id);
        res.json({ success: true, data });
    }
    catch (e) {
        next(e);
    }
});
router.patch('/mark-all-read', async (req, res, next) => {
    try {
        await notification_service_1.notificationService.markAllRead(req.user.id);
        res.json({ success: true });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=notification.routes.js.map