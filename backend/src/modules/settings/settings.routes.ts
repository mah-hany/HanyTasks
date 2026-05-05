import { Router } from 'express';
import { authenticate, authorizeLevel } from '../../middleware/auth';
import { Response, NextFunction } from 'express';
import prisma from '../../prisma/client';

const router = Router();
router.use(authenticate);
router.use(authorizeLevel(1)); // SuperAdmin only

router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    res.json({ success: true, data: map });
  } catch (e) { next(e); }
});

router.put('/:key', async (req, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const setting = await prisma.systemSetting.upsert({
      where: { key }, update: { value }, create: { key, value },
    });
    res.json({ success: true, data: setting });
  } catch (e) { next(e); }
});

router.get('/roles/permissions', async (_req, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({
      include: { permissions: true }
    });
    res.json({ success: true, data: roles });
  } catch (e) { next(e); }
});

router.put('/roles/:roleId/permissions/:moduleId', async (req, res: Response, next: NextFunction) => {
  try {
    const roleId = parseInt(req.params.roleId);
    const moduleId = parseInt(req.params.moduleId);
    const data = req.body; // { canRead, canCreate, canUpdate, canDelete, etc }
    
    const perm = await prisma.permission.update({
      where: { id: moduleId },
      data: {
        canCreate: data.canCreate,
        canRead: data.canRead,
        canUpdate: data.canUpdate,
        canDelete: data.canDelete,
        canAssign: data.canAssign,
        canReport: data.canReport
      }
    });
    res.json({ success: true, data: perm });
  } catch (e) { next(e); }
});

export default router;
