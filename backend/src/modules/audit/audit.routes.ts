import { Router } from 'express';
import { authenticate, authorizeLevel } from '../../middleware/auth';
import { AuthRequest } from '../../middleware/auth';
import { Response, NextFunction } from 'express';
import prisma from '../../prisma/client';

const router = Router();
router.use(authenticate);
router.use(authorizeLevel(3));

router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { fullName: true, fullNameAr: true, username: true } } },
      orderBy: { actionDate: 'desc' },
      take: 200,
    });
    res.json({ success: true, data: logs });
  } catch (e) { next(e); }
});

router.delete('/', authorizeLevel(1), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type } = req.query; // 'all' or 'old'
    let count;
    if (type === 'old') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      count = await prisma.auditLog.deleteMany({
        where: { actionDate: { lt: thirtyDaysAgo } }
      });
    } else {
      count = await prisma.auditLog.deleteMany({});
    }
    
    await prisma.auditLog.create({
      data: { action: type === 'old' ? 'DELETE_OLD_AUDIT' : 'CLEAR_AUDIT', tableAffected: 'tbl_AuditLog', userId: req.user!.id },
    });

    res.json({ success: true, message: `Deleted ${count.count} records.` });
  } catch (e) { next(e); }
});

export default router;
