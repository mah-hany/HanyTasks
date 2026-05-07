"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const client_1 = __importDefault(require("../../prisma/client"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// ── Export Tasks as CSV (Excel-compatible) ────────────────────
router.get('/tasks/csv', async (req, res, next) => {
    try {
        const { status, priority, from, to, assignedToId } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (priority)
            where.priority = priority;
        if (assignedToId)
            where.assignedToId = +assignedToId;
        if (from || to) {
            where.dueDate = {};
            if (from)
                where.dueDate.gte = new Date(from);
            if (to)
                where.dueDate.lte = new Date(to);
        }
        // Role-based filter
        if (req.user.roleLevel > 1) {
            const users = await client_1.default.user.findMany({ select: { id: true, managerId: true } });
            const childrenMap = new Map();
            for (const u of users) {
                if (u.managerId) {
                    if (!childrenMap.has(u.managerId))
                        childrenMap.set(u.managerId, []);
                    childrenMap.get(u.managerId).push(u.id);
                }
            }
            const subIds = [];
            const queue = [req.user.id];
            while (queue.length > 0) {
                const cur = queue.shift();
                const children = childrenMap.get(cur) || [];
                subIds.push(...children);
                queue.push(...children);
            }
            where.assignedToId = { in: [req.user.id, ...subIds] };
        }
        const tasks = await client_1.default.task.findMany({
            where,
            include: {
                assignedTo: { select: { fullName: true, fullNameAr: true, employeeCode: true } },
                createdBy: { select: { fullName: true, fullNameAr: true } },
                category: { select: { name: true, nameAr: true } },
            },
            orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        });
        // Build CSV
        const headers = [
            'Task Code', 'Title', 'Title (AR)', 'Status', 'Priority',
            'Assigned To', 'Created By', 'Category', 'Start Date', 'Due Date',
            'Progress %', 'Completed Date', 'Created At',
        ];
        const statusLabels = {
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
            t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-GB') : '',
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
    }
    catch (e) {
        next(e);
    }
});
// ── Export Employee Performance as CSV ───────────────────────
router.get('/report/employee/:id/csv', async (req, res, next) => {
    try {
        const userId = +req.params.id;
        const { from, to } = req.query;
        const dateFilter = from || to ? {
            createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
            }
        } : {};
        const [user, tasks] = await Promise.all([
            client_1.default.user.findUnique({ where: { id: userId }, include: { role: true, department: true } }),
            client_1.default.task.findMany({
                where: { assignedToId: userId, ...dateFilter },
                include: { category: true },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        const completed = tasks.filter(t => t.status === 'COMPLETED').length;
        const overdue = tasks.filter(t => t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date()).length;
        const rate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
        const headers = ['Task Code', 'Title', 'Status', 'Priority', 'Category', 'Due Date', 'Completed Date', 'Progress %'];
        const rows = tasks.map(t => [
            t.taskCode,
            `"${(t.title || '').replace(/"/g, '""')}"`,
            t.status,
            t.priority,
            t.category?.name || '',
            t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-GB') : '',
            t.completedDate ? new Date(t.completedDate).toLocaleDateString('en-GB') : '',
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
    }
    catch (e) {
        next(e);
    }
});
// ── Export Dashboard Summary as JSON (for PDF generation on frontend) ──
router.get('/dashboard/json', async (req, res, next) => {
    try {
        const now = new Date();
        const [total, completed, inProgress, overdue, users, depts] = await Promise.all([
            client_1.default.task.count(),
            client_1.default.task.count({ where: { status: 'COMPLETED' } }),
            client_1.default.task.count({ where: { status: 'IN_PROGRESS' } }),
            client_1.default.task.count({ where: { status: { not: 'COMPLETED' }, dueDate: { lt: now } } }),
            client_1.default.user.count({ where: { isActive: true } }),
            client_1.default.department.count(),
        ]);
        const topPerformers = await client_1.default.user.findMany({
            where: { isActive: true },
            take: 10,
            include: {
                role: { select: { nameAr: true, name: true } },
                department: { select: { nameAr: true, name: true } },
                _count: { select: { tasksAssigned: true } },
            },
        });
        const performersWithStats = await Promise.all(topPerformers.map(async (u) => {
            const completedCount = await client_1.default.task.count({ where: { assignedToId: u.id, status: 'COMPLETED' } });
            const rate = u._count.tasksAssigned > 0 ? Math.round((completedCount / u._count.tasksAssigned) * 100) : 0;
            return { ...u, completedCount, completionRate: rate };
        }));
        const sorted = performersWithStats.sort((a, b) => b.completionRate - a.completionRate);
        res.json({
            success: true,
            data: {
                generatedAt: new Date(),
                summary: { total, completed, inProgress, overdue, users, depts, completionRate: total > 0 ? Math.round(completed / total * 100) : 0 },
                topPerformers: sorted,
            },
        });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=export.routes.js.map