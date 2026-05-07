import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { AuthRequest } from '../../middleware/auth';
import { Response, NextFunction } from 'express';
import prisma from '../../prisma/client';

const router = Router();
router.use(authenticate);

// GET all checklist items for a task
router.get('/:taskId/checklist', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.taskChecklist.findMany({
      where: { taskId: +req.params.taskId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: items });
  } catch (e) { next(e); }
});

// POST add a checklist item
router.post('/:taskId/checklist', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { text, textAr, sortOrder } = req.body;
    const count = await prisma.taskChecklist.count({ where: { taskId: +req.params.taskId } });
    const item = await prisma.taskChecklist.create({
      data: {
        taskId: +req.params.taskId,
        text,
        textAr,
        sortOrder: sortOrder ?? count,
      },
    });
    res.status(201).json({ success: true, data: item });
  } catch (e) { next(e); }
});

// PATCH toggle checklist item
router.patch('/:taskId/checklist/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { isCompleted, text, textAr } = req.body;
    const data: any = {};
    if (isCompleted !== undefined) {
      data.isCompleted = isCompleted;
      data.completedAt = isCompleted ? new Date() : null;
    }
    if (text !== undefined) data.text = text;
    if (textAr !== undefined) data.textAr = textAr;

    const item = await prisma.taskChecklist.update({
      where: { id: +req.params.itemId },
      data,
    });

    // Auto-update task progress based on checklist completion
    const taskId = +req.params.taskId;
    const allItems = await prisma.taskChecklist.findMany({ where: { taskId } });
    if (allItems.length > 0) {
      const completedCount = allItems.filter(i => i.isCompleted).length;
      const progress = Math.round((completedCount / allItems.length) * 100);
      await prisma.task.update({
        where: { id: taskId },
        data: { progressPercent: progress },
      });
    }

    res.json({ success: true, data: item });
  } catch (e) { next(e); }
});

// DELETE checklist item
router.delete('/:taskId/checklist/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.taskChecklist.delete({ where: { id: +req.params.itemId } });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { next(e); }
});

// PATCH reorder checklist items
router.patch('/:taskId/checklist/reorder', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body as { items: { id: number; sortOrder: number }[] };
    await Promise.all(
      items.map(item => prisma.taskChecklist.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }))
    );
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
