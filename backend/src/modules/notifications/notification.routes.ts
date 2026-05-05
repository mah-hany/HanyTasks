import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { notificationService } from './notification.service';
import { AuthRequest } from '../../middleware/auth';
import { Response, NextFunction } from 'express';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const data = await notificationService.getForUser(req.user!.id, unreadOnly);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.get('/unread-count', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);
    res.json({ success: true, data: { count } });
  } catch (e) { next(e); }
});

router.patch('/:id/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await notificationService.markRead(+req.params.id, req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.patch('/mark-all-read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAllRead(req.user!.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
