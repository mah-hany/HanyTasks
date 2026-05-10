import { Router } from 'express';
import { userController, uploadAvatar } from './user.controller';
import { authenticate, authorizeLevel } from '../../middleware/auth';
import prisma from '../../prisma/client';

const router = Router();

router.use(authenticate);

// ── All authenticated users: list assignable employees (for task form dropdown) ──
router.get('/assignable', async (_req: any, res: any, next: any) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        fullNameAr: true,
        employeeCode: true,
        profilePhoto: true,
        department: { select: { name: true, nameAr: true } },
      },
      orderBy: { fullNameAr: 'asc' },
    });
    res.json({ success: true, data: users });
  } catch (e) { next(e); }
});

router.get('/org-tree',             userController.getOrgTree);
router.get('/',                     authorizeLevel(2), userController.getAll);
router.get('/:id',                  userController.getById);
router.post('/',                    authorizeLevel(2), userController.create);
router.put('/:id',                  authorizeLevel(2), userController.update);
router.post('/:id/reset-password',  authorizeLevel(2), userController.resetPassword);
router.post('/:id/transfer',        authorizeLevel(2), userController.transfer);
router.post('/:id/photo',           uploadAvatar.single('photo'), userController.uploadPhoto);
router.get('/credentials',          authorizeLevel(1), userController.getCredentials);
router.delete('/:id',               authorizeLevel(1), userController.delete);

export default router;
