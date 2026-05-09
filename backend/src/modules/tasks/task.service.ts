import prisma from '../../prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { TaskStatus, TaskPriority } from '../../types/enums';
import { notificationService } from '../notifications/notification.service';
import { sendEmail, taskAssignedEmail } from '../email/email.service';

function generateTaskCode(): string {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 90000) + 10000);
  return `TSK-${year}-${rand}`;
}

async function getSubordinateIds(managerId: number): Promise<number[]> {
  const users = await prisma.user.findMany({ select: { id: true, managerId: true } });
  const childrenMap = new Map<number, number[]>();
  for (const u of users) {
    if (u.managerId) {
      if (!childrenMap.has(u.managerId)) childrenMap.set(u.managerId, []);
      childrenMap.get(u.managerId)!.push(u.id);
    }
  }
  
  const subIds: number[] = [];
  const queue = [managerId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childrenMap.get(current) || [];
    subIds.push(...children);
    queue.push(...children);
  }
  return subIds;
}

export const taskService = {
  async getAll(filters: {
    status?: TaskStatus; priority?: TaskPriority;
    assignedToId?: number; createdById?: number;
    categoryId?: number; departmentId?: number;
    search?: string; fromDate?: string; toDate?: string;
    userId?: number; userRoleLevel?: number;
  }) {
    const where: any = {};

    if (filters.userRoleLevel && filters.userRoleLevel > 1 && filters.userId) {
      const subordinateIds = await getSubordinateIds(filters.userId);
      where.assignedToId = { in: [filters.userId, ...subordinateIds] };
    }

    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;
    if (filters.createdById) where.createdById = filters.createdById;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { taskCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.fromDate || filters.toDate) {
      where.dueDate = {};
      if (filters.fromDate) where.dueDate.gte = new Date(filters.fromDate);
      if (filters.toDate) where.dueDate.lte = new Date(filters.toDate);
    }

    return prisma.task.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true, employeeCode: true } },
        createdBy: { select: { id: true, fullName: true, fullNameAr: true } },
        category: true,
        _count: { select: { comments: true, attachments: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
  },

  async getById(id: number) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: { include: { department: true, role: true } },
        createdBy: { select: { id: true, fullName: true, fullNameAr: true } },
        category: true,
        statusHistory: {
          include: { changedBy: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } } },
          orderBy: { changeDate: 'asc' },
        },
        comments: {
          include: { user: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } } },
          orderBy: { commentDate: 'asc' },
        },
        attachments: true,
      },
    });
    if (!task) throw new AppError('Task not found', 404);
    return task;
  },

  async create(data: {
    title: string; titleAr?: string; description?: string;
    categoryId?: number; priority: TaskPriority; assignedToId: number;
    createdById: number; startDate?: string; dueDate?: string;
  }) {
    let taskCode: string;
    let attempts = 0;
    do {
      taskCode = generateTaskCode();
      const exists = await prisma.task.findUnique({ where: { taskCode } });
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    const task = await prisma.task.create({
      data: {
        taskCode: taskCode!,
        title: data.title,
        titleAr: data.titleAr,
        description: data.description,
        categoryId: data.categoryId,
        priority: data.priority,
        assignedToId: data.assignedToId,
        createdById: data.createdById,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: 'NEW',
      },
      include: { assignedTo: true, createdBy: true, category: true },
    });

    // Record initial status
    await prisma.taskStatusHistory.create({
      data: { taskId: task.id, toStatus: 'NEW', changedById: data.createdById },
    });

    // Notify assignee (in-app)
    await notificationService.create({
      receiverId: data.assignedToId,
      senderId: data.createdById,
      taskId: task.id,
      type: 'TASK_ASSIGNED',
      title: 'New Task Assigned',
      titleAr: 'تم إسناد مهمة جديدة إليك',
      message: `Task "${task.title}" has been assigned to you`,
      messageAr: `تم إسناد المهمة "${task.titleAr || task.title}" إليك`,
    });

    // Send email notification
    const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
    if (assignee?.email) {
      sendEmail({
        to: assignee.email,
        subject: `📋 مهمة جديدة: ${task.titleAr || task.title}`,
        html: taskAssignedEmail(
          task.titleAr || task.title,
          task.taskCode,
          assignee.fullNameAr || assignee.fullName,
          data.dueDate ? new Date(data.dueDate).toLocaleDateString('ar-EG') : undefined,
        ),
      }).catch(() => {}); // fire-and-forget
    }

    return task;
  },

  async updateStatus(taskId: number, newStatus: TaskStatus, userId: number, note?: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new AppError('Task not found', 404);

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        completedDate: newStatus === 'COMPLETED' ? new Date() : null,
      },
    });

    await prisma.taskStatusHistory.create({
      data: { taskId, fromStatus: task.status, toStatus: newStatus, changedById: userId, note },
    });

    // Notify + award points on completion
    if (newStatus === 'COMPLETED' || newStatus === 'UNDER_REVIEW') {
      await notificationService.create({
        receiverId: task.createdById,
        senderId: userId,
        taskId,
        type: newStatus === 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_SUBMITTED',
        title: newStatus === 'COMPLETED' ? 'Task Completed' : 'Task Submitted for Review',
        titleAr: newStatus === 'COMPLETED' ? 'اكتملت المهمة' : 'تم إرسال المهمة للمراجعة',
        message: `Task "${task.title}" status changed to ${newStatus}`,
        messageAr: `تغيرت حالة المهمة "${task.titleAr || task.title}" إلى ${newStatus}`,
      });

      // Award gamification points on completion
      if (newStatus === 'COMPLETED') {
        const now = new Date();
        const isLate   = !task.dueDate || task.dueDate < now;
        const isEarly  = !isLate && task.dueDate && (task.dueDate.getTime() - now.getTime()) > 24 * 60 * 60 * 1000;
        const isOnTime = !isLate && !isEarly;
        const basePoints = 10;
        const bonus = isEarly ? 5 : isOnTime ? 2 : 0;

        await prisma.userPoint.create({
          data: { userId: task.assignedToId, points: basePoints + bonus, reason: isEarly ? 'EARLY' : isOnTime ? 'ON_TIME' : 'TASK_COMPLETED', taskId },
        });
      }
    }

    if (newStatus === 'REVISION_REQUIRED') {
      await notificationService.create({
        receiverId: task.assignedToId,
        senderId: userId,
        taskId,
        type: 'TASK_REVISION',
        title: 'Revision Required',
        titleAr: 'المهمة تحتاج تعديل',
        message: `Task "${task.title}" requires revision`,
        messageAr: `المهمة "${task.titleAr || task.title}" تحتاج إلى تعديل`,
      });
    }

    return updated;
  },

  async updateProgress(taskId: number, progress: number, userId: number) {
    if (progress < 0 || progress > 100) throw new AppError('Progress must be 0-100', 400);
    return prisma.task.update({
      where: { id: taskId },
      data: { progressPercent: progress, status: progress > 0 ? 'IN_PROGRESS' : 'NEW' },
    });
  },

  async addComment(taskId: number, userId: number, text: string, isManagerNote = false) {
    return prisma.taskComment.create({
      data: { taskId, userId, commentText: text, isManagerNote },
      include: { user: { select: { id: true, fullName: true, fullNameAr: true, profilePhoto: true } } },
    });
  },

  async getDashboardStats(userId: number, roleLevel: number) {
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let baseWhere: any = {};
    if (roleLevel > 1) {
      const subordinateIds = await getSubordinateIds(userId);
      baseWhere.assignedToId = { in: [userId, ...subordinateIds] };
    }

    const [total, inProgress, completed, overdue, completedThisWeek] = await Promise.all([
      prisma.task.count({ where: { ...baseWhere, status: { not: 'CANCELLED' } } }),
      prisma.task.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
      prisma.task.count({ where: { ...baseWhere, status: { not: 'COMPLETED' }, dueDate: { lt: now } } }),
      prisma.task.count({ where: { ...baseWhere, status: 'COMPLETED', completedDate: { gte: weekStart } } }),
    ]);

    // Monthly chart data (last 6 months)
    const monthlyData = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return prisma.task.count({
          where: { ...baseWhere, status: 'COMPLETED', completedDate: { gte: d, lte: end } },
        }).then(count => ({ month: d.toLocaleString('ar-EG', { month: 'short' }), count }));
      })
    );

    const statusDist = await prisma.task.groupBy({
      by: ['status'], where: baseWhere, _count: { id: true },
    });

    const recentTasks = await prisma.task.findMany({
      where: { ...baseWhere, status: { not: 'COMPLETED' } },
      include: { assignedTo: { select: { fullName: true, fullNameAr: true, profilePhoto: true } }, category: true },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 5,
    });

    return { total, inProgress, completed, overdue, completedThisWeek, monthlyData, statusDist, recentTasks };
  },

  async delete(id: number) {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) throw new AppError('Task not found', 404);

    try {
      // Delete notifications linked to this task first
      await prisma.notification.deleteMany({ where: { taskId: id } });
      
      // The rest (comments, attachments, status history) are cascaded in Prisma
      await prisma.task.delete({ where: { id } });
      return { message: 'Task deleted successfully' };
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new AppError('Cannot delete this task because it is linked to other records.', 400);
      }
      throw error;
    }
  },
};
