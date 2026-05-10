import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import prisma from '../../prisma/client';

const router = Router();
router.use(authenticate);

// GET all contractors
router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.contractor.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// POST create contractor (MANAGER+)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user!.roleLevel ?? 99) > 3) return res.status(403).json({ success: false, message: 'Forbidden' });
    const { name, nameAr, phone, email } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name required' });
    const data = await prisma.contractor.create({ data: { name, nameAr, phone, email } });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
});

// PUT update
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user!.roleLevel ?? 99) > 3) return res.status(403).json({ success: false, message: 'Forbidden' });
    const data = await prisma.contractor.update({
      where: { id: +req.params.id },
      data: req.body,
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

export default router;
