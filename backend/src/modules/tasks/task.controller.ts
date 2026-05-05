import { Request, Response, NextFunction } from 'express';
import { taskService } from './task.service';
import { AuthRequest } from '../../middleware/auth';
import { TaskStatus, TaskPriority } from '../../types/enums';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../../prisma/client';

const uploadDir = path.join(process.cwd(), 'uploads', 'attachments');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
export const uploadAttachment = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

export const taskController = {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await taskService.getAll({
        ...req.query as any,
        userId: req.user!.id,
        userRoleLevel: req.user!.roleLevel,
      });
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await taskService.getById(+req.params.id) }); }
    catch (e) { next(e); }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await taskService.create({ ...req.body, createdById: req.user!.id });
      res.status(201).json({ success: true, data });
    } catch (e) { next(e); }
  },

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, note } = req.body;
      const data = await taskService.updateStatus(+req.params.id, status as TaskStatus, req.user!.id, note);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async updateProgress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await taskService.updateProgress(+req.params.id, +req.body.progress, req.user!.id);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async addComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await taskService.addComment(+req.params.id, req.user!.id, req.body.text, req.body.isManagerNote);
      res.status(201).json({ success: true, data });
    } catch (e) { next(e); }
  },

  async addAttachment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
      const att = await prisma.taskAttachment.create({
        data: {
          taskId: +req.params.id,
          fileName: req.file.originalname,
          fileUrl: `/uploads/attachments/${req.file.filename}`,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
          uploadedById: req.user!.id,
        },
      });
      res.status(201).json({ success: true, data: att });
    } catch (e) { next(e); }
  },

  async getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await taskService.getDashboardStats(req.user!.id, req.user!.roleLevel);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async getCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await prisma.taskCategory.findMany({ orderBy: { name: 'asc' } });
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await taskService.delete(+req.params.id);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },
};
