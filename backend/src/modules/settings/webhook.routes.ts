import { Router } from 'express';
import prisma from '../../prisma/client';
import { authenticate, authorizeLevel } from '../../middleware/auth';

const router = Router();
router.use(authenticate, authorizeLevel(1)); // SuperAdmin only

router.get('/', async (req, res, next) => {
  try {
    const hooks = await prisma.webhook.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: hooks });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, url, eventTypes, secret, isActive } = req.body;
    const user = (req as any).user;
    const hook = await prisma.webhook.create({
      data: { name, url, eventTypes, secret, isActive, createdById: user.id }
    });
    res.status(201).json({ success: true, data: hook });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, url, eventTypes, secret, isActive } = req.body;
    const hook = await prisma.webhook.update({
      where: { id: +req.params.id },
      data: { name, url, eventTypes, secret, isActive }
    });
    res.json({ success: true, data: hook });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.webhook.delete({ where: { id: +req.params.id } });
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (e) { next(e); }
});

export default router;
