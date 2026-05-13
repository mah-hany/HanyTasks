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

// ── Export Tasks as PDF ──────────────────────────────────────────
router.get('/tasks/pdf', async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    const statusLabels: Record<string, string> = {
      NEW: 'جديدة', IN_PROGRESS: 'قيد التنفيذ', UNDER_REVIEW: 'تحت المراجعة',
      REVISION_REQUIRED: 'تحتاج تعديل', COMPLETED: 'مكتملة', CANCELLED: 'ملغاة',
    };
    
    const priorityLabels: Record<string, string> = {
      URGENT: 'عاجل', HIGH: 'عالٍ', MEDIUM: 'متوسط', LOW: 'منخفض'
    };

    let html = `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
          h1 { text-align: center; color: #2563eb; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th { background: #f8fafc; padding: 10px; text-align: right; border-bottom: 2px solid #cbd5e1; color: #475569; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f1f5f9; }
        </style>
      </head>
      <body>
        <h1>تقرير المهام</h1>
        <table>
          <thead>
            <tr>
              <th>كود المهمة</th>
              <th>العنوان</th>
              <th>الحالة</th>
              <th>الأولوية</th>
              <th>الموظف</th>
              <th>تاريخ الانتهاء</th>
              <th>نسبة الإنجاز</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(t => `
              <tr>
                <td>${t.taskCode}</td>
                <td>${t.titleAr || t.title}</td>
                <td>${statusLabels[t.status] || t.status}</td>
                <td>${priorityLabels[t.priority] || t.priority}</td>
                <td>${t.assignedTo?.fullNameAr || t.assignedTo?.fullName || '-'}</td>
                <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString('ar-EG') : '-'}</td>
                <td>${t.progressPercent}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const pdf = await generatePdf(html, { landscape: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="tasks-${Date.now()}.pdf"`);
    res.send(pdf);
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

import { generatePdf } from '../../shared/utils/pdf.service';

// ── Export Extracts as PDF ──────────────────────────────────────────
router.get('/extracts/pdf', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, projectId, contractorId, dateFrom, dateTo } = req.query as any;

    const where: any = {};
    if (projectId)    where.projectId    = +projectId;
    if (contractorId) where.contractorId = +contractorId;
    if (status)       where.status       = status;
    if (dateFrom || dateTo) {
      where.receivedAt = {};
      if (dateFrom) where.receivedAt.gte = new Date(dateFrom);
      if (dateTo)   where.receivedAt.lte = new Date(dateTo);
    }

    const extracts = await prisma.taskExtract.findMany({
      where,
      include: {
        project: { select: { name: true, nameAr: true } },
        contractor: { select: { name: true, nameAr: true } },
      },
      orderBy: { receivedAt: 'desc' },
    });

    const statusLabels: Record<string, string> = {
      RECEIVED: 'مستلم', UNDER_REVIEW: 'تحت المراجعة', RETURNED: 'مرتجع', POSTED: 'مدرج'
    };

    let html = `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
          h1 { text-align: center; color: #2563eb; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
          th { background: #f8fafc; padding: 12px; text-align: right; border-bottom: 2px solid #cbd5e1; color: #475569; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f1f5f9; }
        </style>
      </head>
      <body>
        <h1>تقرير المستخلصات</h1>
        <table>
          <thead>
            <tr>
              <th>رقم المستخلص</th>
              <th>المقاول</th>
              <th>المشروع</th>
              <th>الحالة</th>
              <th>المبلغ</th>
              <th>تاريخ الاستلام</th>
            </tr>
          </thead>
          <tbody>
            ${extracts.map(e => `
              <tr>
                <td>${e.extractNumber}</td>
                <td>${e.contractor?.nameAr || e.contractor?.name}</td>
                <td>${e.project?.nameAr || e.project?.name}</td>
                <td>${statusLabels[e.status] || e.status}</td>
                <td>${e.amount ? e.amount.toLocaleString() + ' ' + (e.currency || 'SAR') : '-'}</td>
                <td>${new Date(e.receivedAt).toLocaleDateString('ar-EG')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const pdf = await generatePdf(html, { landscape: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="extracts-${Date.now()}.pdf"`);
    res.send(pdf);
  } catch (e) { next(e); }
});

// ── Export Employee Performance as PDF ────────────────────────
router.get('/report/employee/:id/pdf', async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    let html = `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
          h1 { text-align: center; color: #f97316; margin-bottom: 30px; }
          .summary { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px; background: #fff7ed; padding: 20px; border-radius: 8px; border: 1px solid #fdba74; }
          .summary-item { flex: 1; min-width: 200px; font-size: 16px; }
          .summary-item strong { color: #c2410c; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #f8fafc; padding: 10px; text-align: right; border-bottom: 2px solid #cbd5e1; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <h1>تقرير أداء الموظف</h1>
        <div class="summary">
          <div class="summary-item">الموظف: <strong>${user?.fullNameAr || user?.fullName}</strong></div>
          <div class="summary-item">الدور: <strong>${user?.role?.nameAr || user?.role?.name}</strong></div>
          <div class="summary-item">إجمالي المهام: <strong>${tasks.length}</strong></div>
          <div class="summary-item">المهام المكتملة: <strong>${completed}</strong></div>
          <div class="summary-item">المهام المتأخرة: <strong>${overdue}</strong></div>
          <div class="summary-item">نسبة الإنجاز: <strong>${rate}%</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>كود المهمة</th>
              <th>العنوان</th>
              <th>الحالة</th>
              <th>الأولوية</th>
              <th>تاريخ الانتهاء المتوقع</th>
              <th>نسبة الإنجاز</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(t => `
              <tr>
                <td>${t.taskCode}</td>
                <td>${t.titleAr || t.title}</td>
                <td>${t.status}</td>
                <td>${t.priority}</td>
                <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString('ar-EG') : '-'}</td>
                <td>${t.progressPercent}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const pdf = await generatePdf(html, { landscape: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="employee-report-${user?.employeeCode}-${Date.now()}.pdf"`);
    res.send(pdf);
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
