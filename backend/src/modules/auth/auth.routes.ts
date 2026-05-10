import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.post('/login',           authController.login);
router.post('/refresh',         authController.refresh);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password',  authController.resetPassword);
router.post('/logout',          authenticate, authController.logout);
router.post('/change-password', authenticate, authController.changePassword);
router.get('/profile',          authenticate, authController.getProfile);

export default router;
