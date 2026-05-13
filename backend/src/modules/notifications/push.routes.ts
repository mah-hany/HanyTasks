import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { pushService } from './push.service';

const router = Router();
router.use(authenticate);

// GET /api/push/vapid-key — return public VAPID key to frontend
router.get('/vapid-key', (_req, res) => {
  res.json({ success: true, publicKey: pushService.getPublicKey() });
});

// POST /api/push/subscribe — save browser push subscription
router.post('/subscribe', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { endpoint, keys, userAgent } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, message: 'Invalid subscription object' });
    }

    await pushService.subscribe(req.user!.id, { endpoint, keys, userAgent });
    res.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (e) { next(e); }
});

// DELETE /api/push/unsubscribe — remove a subscription
router.delete('/unsubscribe', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ success: false, message: 'endpoint required' });
    await pushService.unsubscribe(endpoint);
    res.json({ success: true, message: 'Unsubscribed' });
  } catch (e) { next(e); }
});

// POST /api/push/test — send a test push to yourself (for debugging)
router.post('/test', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await pushService.sendToUser(req.user!.id, {
      title: '🔔 اختبار الإشعارات',
      body:  'إذا ظهر هذا الإشعار فإن نظام الإشعارات يعمل بشكل صحيح ✅',
      url:   '/notifications',
      tag:   'test-push',
    });
    res.json({ success: true, message: 'Test push sent' });
  } catch (e) { next(e); }
});

export default router;
