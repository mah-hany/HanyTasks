import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { AuthRequest } from '../../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
export const uploadAvatar = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

export const userController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { departmentId, roleId, isActive, search } = req.query;
      const data = await userService.getAll({
        departmentId: departmentId ? +departmentId : undefined,
        roleId: roleId ? +roleId : undefined,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        search: search as string | undefined,
      });
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await userService.getById(+req.params.id);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await userService.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (e) { next(e); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await userService.update(+req.params.id, req.body);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { newPassword } = req.body;
      const data = await userService.resetPassword(+req.params.id, newPassword);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async transfer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { toDeptId, note } = req.body;
      const data = await userService.transfer(+req.params.id, toDeptId, note, req.user!.id);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async getOrgTree(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await userService.getOrgTree();
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async uploadPhoto(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
      const photoUrl = `/uploads/avatars/${req.file.filename}`;
      await userService.update(+req.params.id, { profilePhoto: photoUrl });
      res.json({ success: true, data: { photoUrl } });
    } catch (e) { next(e); }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await userService.delete(+req.params.id);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async getCredentials(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await userService.getCredentials();
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },
};
