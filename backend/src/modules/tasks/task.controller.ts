import { Request, Response, NextFunction } from 'express';
import { taskService } from './task.service';
import { AuthRequest } from '../../middleware/auth';
import { TaskStatus } from '../../types/enums';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../../prisma/client';

const uploadDir = path.join(process.cwd(), 'uploads', 'attachments');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const utf8Name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${Date.now()}-${utf8Name}`);
  },
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
    try {
      const task = await taskService.getById(+req.params.id);
      const checklist = await prisma.taskChecklist.findMany({
        where: { taskId: +req.params.id },
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: { ...task, checklist } });
    } catch (e) { next(e); }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await taskService.create({ ...req.body, createdById: req.user!.id });

      // If created from template, clone checklist items
      if (req.body.templateId) {
        const template = await prisma.taskTemplate.findUnique({ where: { id: +req.body.templateId } });
        if (template?.checklistItems) {
          const items: { text: string; textAr?: string }[] = JSON.parse(template.checklistItems);
          await Promise.all(items.map((item, idx) =>
            prisma.taskChecklist.create({
              data: { taskId: data.id, text: item.text, textAr: item.textAr, sortOrder: idx },
            })
          ));
        }
      }
      res.status(201).json({ success: true, data });
    } catch (e) { next(e); }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await taskService.update(+req.params.id, req.body);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  async archive(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await taskService.archive(+req.params.id, req.body.isArchived, req.user!.id);
      res.json({ success: true, data });
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
      const utf8Name = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      const att = await prisma.taskAttachment.create({
        data: {
          taskId: +req.params.id,
          fileName: utf8Name,
          fileUrl: `/uploads/attachments/${req.file.filename}`,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
          uploadedById: req.user!.id,
        },
      });
      res.status(201).json({ success: true, data: att });
    } catch (e) { next(e); }
  },

  async deleteAttachment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await taskService.deleteAttachment(+req.params.id, +req.params.attachmentId);
      res.json(data);
    } catch (e) { next(e); }
  },

  async getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await taskService.getDashboardStats(req.user!.id, req.user!.roleLevel);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },

  // ── Calendar View ────────────────────────────────────────────
  async getCalendar(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { year, month } = req.query as { year?: string; month?: string };
      const now = new Date();
      const y = year ? +year : now.getFullYear();
      const m = month ? +month - 1 : now.getMonth();

      const from = new Date(y, m, 1);
      const to = new Date(y, m + 1, 0, 23, 59, 59);

      const where: any = {
        OR: [
          { dueDate: { gte: from, lte: to } },
          { startDate: { gte: from, lte: to } },
        ],
      };

      // Restrict by hierarchy
      if (req.user!.roleLevel > 1) {
        const users = await prisma.user.findMany({ select: { id: true, managerId: true } });
        const childrenMap = new Map<number, number[]>();
        for (const u of users) {
          if (u.managerId) {
            if (!childrenMap.has(u.managerId)) childrenMap.set(u.managerId, []);
            childrenMap.get(u.managerId)!.push(u.id);
          }
        }
        const subIds: number[] = [];
        const queue = [req.user!.id];
        while (queue.length > 0) {
          const cur = queue.shift()!;
          const children = childrenMap.get(cur) || [];
          subIds.push(...children);
          queue.push(...children);
        }
        where.assignedToId = { in: [req.user!.id, ...subIds] };
      }

      const tasks = await prisma.task.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } },
          category: true,
        },
        orderBy: { dueDate: 'asc' },
      });

      res.json({ success: true, data: tasks });
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
