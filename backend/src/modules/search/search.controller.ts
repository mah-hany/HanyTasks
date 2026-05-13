import { Request, Response, NextFunction } from 'express';
import prisma from '../../prisma/client';
import { AuthRequest } from '../../middleware/auth';

export const searchController = {
  async globalSearch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const q = (req.query.q as string || '').trim().toLowerCase();
      if (!q) {
        return res.json({ success: true, data: { tasks: [], extracts: [], users: [], notifications: [] } });
      }

      // Tasks
      const tasks = await prisma.task.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { titleAr: { contains: q, mode: 'insensitive' } },
            { taskCode: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, titleAr: true, taskCode: true, status: true, priority: true },
        take: 10,
      });

      // Extracts
      let extractNum = parseInt(q, 10);
      const extracts = await prisma.taskExtract.findMany({
        where: {
          OR: [
            ...(isNaN(extractNum) ? [] : [{ extractNumber: extractNum }]),
            { notes: { contains: q, mode: 'insensitive' } },
          ]
        },
        select: { id: true, extractNumber: true, status: true, project: { select: { name: true } }, contractor: { select: { name: true } } },
        take: 10,
      });

      // Users
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { fullNameAr: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ]
        },
        select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, role: { select: { name: true, nameAr: true } } },
        take: 10,
      });

      // Notifications
      const notifications = await prisma.notification.findMany({
        where: {
          receiverId: req.user!.id,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { titleAr: { contains: q, mode: 'insensitive' } },
            { message: { contains: q, mode: 'insensitive' } },
            { messageAr: { contains: q, mode: 'insensitive' } },
          ]
        },
        select: { id: true, title: true, titleAr: true, message: true, messageAr: true, isRead: true, createdAt: true },
        take: 10,
      });

      res.json({
        success: true,
        data: { tasks, extracts, users, notifications }
      });
    } catch (e) {
      next(e);
    }
  }
};
