import { Router } from 'express';
import { authenticate, authorizeLevel } from '../../middleware/auth';
import { AuthRequest } from '../../middleware/auth';
import { Response, NextFunction } from 'express';
import prisma from '../../prisma/client';

const router = Router();
router.use(authenticate);

// GET all templates (global + own)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.taskTemplate.findMany({
      where: {
        OR: [
          { isGlobal: true },
          { createdById: req.user!.id },
        ],
      },
      orderBy: [{ isGlobal: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: templates });
  } catch (e) { next(e); }
});

// GET single template
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.taskTemplate.findUnique({ where: { id: +req.params.id } });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (e) { next(e); }
});

// POST create template
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, nameAr, description, categoryId, priority, defaultDuration, checklistItems, isGlobal } = req.body;
    const template = await prisma.taskTemplate.create({
      data: {
        name,
        nameAr,
        description,
        categoryId: categoryId ? +categoryId : null,
        priority: priority || 'MEDIUM',
        defaultDuration: defaultDuration ? +defaultDuration : null,
        checklistItems: checklistItems ? JSON.stringify(checklistItems) : null,
        isGlobal: isGlobal && req.user!.roleLevel <= 2 ? true : false,
        createdById: req.user!.id,
      },
    });
    res.status(201).json({ success: true, data: template });
  } catch (e) { next(e); }
});

// PUT update template
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, nameAr, description, categoryId, priority, defaultDuration, checklistItems, isGlobal } = req.body;
    const template = await prisma.taskTemplate.update({
      where: { id: +req.params.id },
      data: {
        name,
        nameAr,
        description,
        categoryId: categoryId ? +categoryId : null,
        priority,
        defaultDuration: defaultDuration ? +defaultDuration : null,
        checklistItems: checklistItems ? JSON.stringify(checklistItems) : null,
        isGlobal: isGlobal && req.user!.roleLevel <= 2 ? true : false,
      },
    });
    res.json({ success: true, data: template });
  } catch (e) { next(e); }
});

// DELETE template
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.taskTemplate.delete({ where: { id: +req.params.id } });
    res.json({ success: true, message: 'Template deleted' });
  } catch (e) { next(e); }
});

export default router;
