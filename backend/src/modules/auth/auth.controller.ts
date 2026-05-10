import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { AuthRequest } from '../../middleware/auth';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(2),
  password: z.string().min(4),
});

const changePassSchema = z.object({
  oldPassword: z.string().min(4),
  newPassword: z.string().min(8),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(6),
  newPassword: z.string().min(8),
});

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const ip = req.ip || req.headers['x-forwarded-for'] as string;
      const result = await authService.login(username, password, ip);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ success: false, message: 'No refresh token' });
      }
      const result = await authService.refresh(refreshToken);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { oldPassword, newPassword } = changePassSchema.parse(req.body);
      const result = await authService.changePassword(req.user!.id, oldPassword, newPassword);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await authService.getProfile(req.user!.id);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  async logout(req: AuthRequest, res: Response) {
    // Stateless JWT — client discards token
    res.json({ success: true, message: 'Logged out successfully' });
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const result = await authService.forgotPassword(email);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);
      const result = await authService.resetPasswordWithToken(token, newPassword);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },
};
