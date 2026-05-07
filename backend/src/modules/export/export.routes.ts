import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { AuthRequest } from '../../middleware/auth';
import { Response, NextFunction } from 'express';
import prisma from '../../prisma/client';

const router = Router();
router.use(authenticate);

// ── Export Tasks as CSV (Excel-compatible) ────────────────────
router.get('/tasks/csv', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, priority, from, to, assignedToId } = req.query as any;

    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedToId) where.assignedToId = +assignedToId;
    if (from || to) {
      where.dueDate = {};
      if (from) where.dueDate.gte = new Date(from);
      if (to)   where.dueDate.lte = new Date(to);
    }

    // Role-based filter
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
        assignedTo: { select: { fullName: true, fullNameAr: true, employeeCode: true } },
        createdBy:  { select: { fullName: true, fullNameAr: true } },
        category:   { select: { name: true, nameAr: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    // Build CSV
    const headers = [
      'Task Code', 'Title', 'Title (AR)', 'Status', 'Priority',
      'Assigned To', 'Created By', 'Category', 'Start Date', 'Due Date',
      'Progress %', 'Completed Date', 'Created At',
    ];

    const statusLabels: Record<string, string> = {
      NEW: 'New', IN_PROGRESS: 'In Progress', UNDER_REVIEW: 'Under Review',
      REVISION_REQUIRED: 'Revision Required', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
    };

    const rows = tasks.map(t => [
      t.taskCode,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.titleAr || '').replace(/"/g, '""')}"`,
      statusLabels[t.status] || t.status,
      t.priority,
      t.assignedTo?.fullName || '',
      t.createdBy?.fullName || '',
      t.category?.name || '',
      t.startDate ? new Date(t.startDate).toLocaleDateString('en-GB') : '',
      t.dueDate   ? new Date(t.dueDate).toLocaleDateString('en-GB')   : '',
      t.progressPercent,
      t.completedDate ? new Date(t.completedDate).toLocaleDateString('en-GB') : '',
      new Date(t.createdAt).toLocaleDateString('en-GB'),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const filename = `tasks-export-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // BOM for Excel Arabic support
    res.send('\uFEFF' + csv);
  } catch (e) { next(e); }
});

// ── Export Employee Performance as CSV ───────────────────────
router.get('/report/employee/:id/csv', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = +req.params.id;
    const { from, to } = req.query as any;

    const dateFilter = from || to ? {
      createdAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      }
    } : {};

    const [user, tasks] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, include: { role: true, department: true } }),
      prisma.task.findMany({
        where: { assignedToId: userId, ...dateFilter },
        include: { category: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const completed = tasks.filter(t => t.status === 'COMPLETED').length;
    const overdue   = tasks.filter(t => t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date()).length;
    const rate      = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    const headers = ['Task Code', 'Title', 'Status', 'Priority', 'Category', 'Due Date', 'Completed Date', 'Progress %'];
    const rows = tasks.map(t => [
      t.taskCode,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      t.category?.name || '',
      t.dueDate        ? new Date(t.dueDate).toLocaleDateString('en-GB')        : '',
      t.completedDate  ? new Date(t.completedDate).toLocaleDateString('en-GB')  : '',
      t.progressPercent,
    ]);

    const summary = [
      `Employee: ${user?.fullName}`,
      `Role: ${user?.role?.name}`,
      `Department: ${user?.department?.name || 'N/A'}`,
      `Total Tasks: ${tasks.length}`,
      `Completed: ${completed}`,
      `Overdue: ${overdue}`,
      `Completion Rate: ${rate}%`,
      '',
    ];

    const csv = [...summary.map(s => `"${s}"`), headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="employee-report-${user?.employeeCode}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (e) { next(e); }
});

// ── Export Dashboard Summary as JSON (for PDF generation on frontend) ──
router.get('/dashboard/json', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const [total, completed, inProgress, overdue, users, depts] = await Promise.all([
      prisma.task.count(),
      prisma.task.count({ where: { status: 'COMPLETED' } }),
      prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { status: { not: 'COMPLETED' }, dueDate: { lt: now } } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.department.count(),
    ]);

    const topPerformers = await prisma.user.findMany({
      where: { isActive: true },
      take: 10,
      include: {
        role: { select: { nameAr: true, name: true } },
        department: { select: { nameAr: true, name: true } },
        _count: { select: { tasksAssigned: true } },
      },
    });

    const performersWithStats = await Promise.all(
      topPerformers.map(async u => {
        const completedCount = await prisma.task.count({ where: { assignedToId: u.id, status: 'COMPLETED' } });
        const rate = u._count.tasksAssigned > 0 ? Math.round((completedCount / u._count.tasksAssigned) * 100) : 0;
        return { ...u, completedCount, completionRate: rate };
      })
    );

    const sorted = performersWithStats.sort((a, b) => b.completionRate - a.completionRate);

    res.json({
      success: true,
      data: {
        generatedAt: new Date(),
        summary: { total, completed, inProgress, overdue, users, depts, completionRate: total > 0 ? Math.round(completed / total * 100) : 0 },
        topPerformers: sorted,
      },
    });
  } catch (e) { next(e); }
});

export default router;
