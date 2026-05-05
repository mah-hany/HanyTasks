import { Router } from 'express';
import { userController, uploadAvatar } from './user.controller';
import { authenticate, authorizeLevel } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/org-tree',             userController.getOrgTree);
router.get('/',                     authorizeLevel(2), userController.getAll);
router.get('/:id',                  userController.getById);
router.post('/',                    authorizeLevel(2), userController.create);
router.put('/:id',                  authorizeLevel(2), userController.update);
router.post('/:id/reset-password',  authorizeLevel(2), userController.resetPassword);
router.post('/:id/transfer',        authorizeLevel(2), userController.transfer);
router.post('/:id/photo',           uploadAvatar.single('photo'), userController.uploadPhoto);
router.delete('/:id',               authorizeLevel(1), userController.delete);

export default router;
