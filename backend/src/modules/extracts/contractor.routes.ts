import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import prisma from '../../prisma/client';

const router = Router();
router.use(authenticate);

// GET all contractors with search
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, active } = req.query as Record<string, string>;
    const where: any = {};
    if (active !== 'all') where.isActive = true;
    if (search) {
      where.OR = [
        { name:   { contains: search, mode: 'insensitive' } },
        { nameAr: { contains: search, mode: 'insensitive' } },
        { phone:  { contains: search, mode: 'insensitive' } },
        { email:  { contains: search, mode: 'insensitive' } },
      ];
    }
    const data = await prisma.contractor.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { extracts: true } } },
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// GET single
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.contractor.findUnique({
      where: { id: +req.params.id },
      include: { _count: { select: { extracts: true } } },
    });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// POST create (SUPERVISOR+)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user!.roleLevel ?? 99) > 4) return res.status(403).json({ success: false, message: 'Forbidden' });
    const { name, nameAr, phone, email } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'الاسم مطلوب' });
    const data = await prisma.contractor.create({ data: { name: name.trim(), nameAr, phone, email } });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
});

// PUT update (SUPERVISOR+)
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user!.roleLevel ?? 99) > 4) return res.status(403).json({ success: false, message: 'Forbidden' });
    const { name, nameAr, phone, email, isActive } = req.body;
    const data = await prisma.contractor.update({
      where: { id: +req.params.id },
      data: { name, nameAr, phone, email, isActive },
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// DELETE (ADMIN+)
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user!.roleLevel ?? 99) > 2) return res.status(403).json({ success: false, message: 'Forbidden' });
    await prisma.contractor.update({ where: { id: +req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Deactivated' });
  } catch (e) { next(e); }
});

export default router;
