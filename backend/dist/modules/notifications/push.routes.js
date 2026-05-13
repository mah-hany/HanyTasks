"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const push_service_1 = require("./push.service");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /api/push/vapid-key — return public VAPID key to frontend
router.get('/vapid-key', (_req, res) => {
    res.json({ success: true, publicKey: push_service_1.pushService.getPublicKey() });
});
// POST /api/push/subscribe — save browser push subscription
router.post('/subscribe', async (req, res, next) => {
    try {
        const { endpoint, keys, userAgent } = req.body;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({ success: false, message: 'Invalid subscription object' });
        }
        await push_service_1.pushService.subscribe(req.user.id, { endpoint, keys, userAgent });
        res.json({ success: true, message: 'Subscribed to push notifications' });
    }
    catch (e) {
        next(e);
    }
});
// DELETE /api/push/unsubscribe — remove a subscription
router.delete('/unsubscribe', async (req, res, next) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint)
            return res.status(400).json({ success: false, message: 'endpoint required' });
        await push_service_1.pushService.unsubscribe(endpoint);
        res.json({ success: true, message: 'Unsubscribed' });
    }
    catch (e) {
        next(e);
    }
});
// POST /api/push/test — send a test push to yourself (for debugging)
router.post('/test', async (req, res, next) => {
    try {
        await push_service_1.pushService.sendToUser(req.user.id, {
            title: '🔔 اختبار الإشعارات',
            body: 'إذا ظهر هذا الإشعار فإن نظام الإشعارات يعمل بشكل صحيح ✅',
            url: '/notifications',
            tag: 'test-push',
        });
        res.json({ success: true, message: 'Test push sent' });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=push.routes.js.map