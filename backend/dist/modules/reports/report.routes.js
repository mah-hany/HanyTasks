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
// Employee performance report
router.get('/employee/:id', async (req, res, next) => {
    try {
        const userId = +req.params.id;
        const { from, to } = req.query;
        const dateFilter = from || to ? {
            createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
            }
        } : {};
        const [assigned, completed, overdue, inProgress, underReview] = await Promise.all([
            client_1.default.task.count({ where: { assignedToId: userId, ...dateFilter } }),
            client_1.default.task.count({ where: { assignedToId: userId, status: 'COMPLETED', ...dateFilter } }),
            client_1.default.task.count({ where: { assignedToId: userId, status: { not: 'COMPLETED' }, dueDate: { lt: new Date() }, ...dateFilter } }),
            client_1.default.task.count({ where: { assignedToId: userId, status: 'IN_PROGRESS', ...dateFilter } }),
            client_1.default.task.count({ where: { assignedToId: userId, status: 'UNDER_REVIEW', ...dateFilter } }),
        ]);
        const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
        const tasks = await client_1.default.task.findMany({
            where: { assignedToId: userId, ...dateFilter },
            include: { category: true, assignedTo: { select: { fullName: true, fullNameAr: true } } },
            orderBy: { createdAt: 'desc' },
        });
        const user = await client_1.default.user.findUnique({
            where: { id: userId },
            include: { role: true, department: true },
        });
        res.json({ success: true, data: { user, stats: { assigned, completed, overdue, inProgress, underReview, completionRate }, tasks } });
    }
    catch (e) {
        next(e);
    }
});
// Department report
router.get('/department/:id', (0, auth_1.authorizeLevel)(3), async (req, res, next) => {
    try {
        const deptId = +req.params.id;
        const employees = await client_1.default.user.findMany({ where: { departmentId: deptId, isActive: true } });
        const stats = await Promise.all(employees.map(async (emp) => {
            const [assigned, completed, overdue] = await Promise.all([
                client_1.default.task.count({ where: { assignedToId: emp.id } }),
                client_1.default.task.count({ where: { assignedToId: emp.id, status: 'COMPLETED' } }),
                client_1.default.task.count({ where: { assignedToId: emp.id, status: { not: 'COMPLETED' }, dueDate: { lt: new Date() } } }),
            ]);
            return { ...emp, assigned, completed, overdue, completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0 };
        }));
        res.json({ success: true, data: stats });
    }
    catch (e) {
        next(e);
    }
});
async function getSubordinateIds(managerId) {
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
    const queue = [managerId];
    while (queue.length > 0) {
        const current = queue.shift();
        const children = childrenMap.get(current) || [];
        subIds.push(...children);
        queue.push(...children);
    }
    return subIds;
}
// Overdue tasks report
router.get('/overdue', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const roleLevel = req.user.roleLevel;
        let assignedToWhere = undefined;
        if (roleLevel > 1) {
            const subIds = await getSubordinateIds(userId);
            assignedToWhere = { in: [userId, ...subIds] };
        }
        const tasks = await client_1.default.task.findMany({
            where: {
                status: { not: 'COMPLETED' },
                dueDate: { lt: new Date() },
                ...(assignedToWhere ? { assignedToId: assignedToWhere } : {})
            },
            include: {
                assignedTo: { include: { department: true } },
                createdBy: { select: { fullName: true, fullNameAr: true } },
                category: true,
            },
            orderBy: { dueDate: 'asc' },
        });
        res.json({ success: true, data: tasks });
    }
    catch (e) {
        next(e);
    }
});
// Summary stats for all departments (filtered by hierarchy)
router.get('/departments-summary', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const roleLevel = req.user.roleLevel;
        let allowedUserIds = null;
        if (roleLevel > 1) {
            const subIds = await getSubordinateIds(userId);
            allowedUserIds = [userId, ...subIds];
        }
        const departments = await client_1.default.department.findMany({ where: { isActive: true } });
        const result = await Promise.all(departments.map(async (dept) => {
            let empIds = (await client_1.default.user.findMany({ where: { departmentId: dept.id }, select: { id: true } })).map(u => u.id);
            if (allowedUserIds) {
                empIds = empIds.filter(id => allowedUserIds.includes(id));
            }
            // If user has no subordinates in this department and isn't in it, they see 0s. 
            // We might want to filter out departments with 0 employees for this user.
            if (empIds.length === 0)
                return null;
            const [assigned, completed, overdue] = await Promise.all([
                client_1.default.task.count({ where: { assignedToId: { in: empIds } } }),
                client_1.default.task.count({ where: { assignedToId: { in: empIds }, status: 'COMPLETED' } }),
                client_1.default.task.count({ where: { assignedToId: { in: empIds }, status: { not: 'COMPLETED' }, dueDate: { lt: new Date() } } }),
            ]);
            return { ...dept, employeeCount: empIds.length, assigned, completed, overdue, completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0 };
        }));
        const finalResult = result.filter(r => r !== null);
        res.json({ success: true, data: finalResult });
    }
    catch (e) {
        next(e);
    }
});
// Extracts Report
router.get('/extracts', (0, auth_1.authorizeLevel)(3), async (req, res, next) => {
    try {
        const { from, to, contractorId } = req.query;
        const dateFilter = from || to ? {
            receivedAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
            }
        } : {};
        const where = { ...dateFilter, ...(contractorId ? { contractorId: +contractorId } : {}) };
        // 1. By Contractor
        const contractors = await client_1.default.contractor.findMany({ where: { isActive: true } });
        const contractorStats = await Promise.all(contractors.map(async (c) => {
            const agg = await client_1.default.taskExtract.aggregate({
                where: { contractorId: c.id, ...dateFilter },
                _count: { id: true },
                _sum: { amount: true }
            });
            const postedCount = await client_1.default.taskExtract.count({ where: { contractorId: c.id, status: 'POSTED', ...dateFilter } });
            const returnedCount = await client_1.default.taskExtract.count({ where: { contractorId: c.id, status: 'RETURNED', ...dateFilter } });
            return {
                contractorName: c.nameAr || c.name,
                total: agg._count.id,
                posted: postedCount,
                returned: returnedCount,
                totalAmount: agg._sum.amount || 0
            };
        }));
        // 2. Average Review Time (Hours)
        const postedExtracts = await client_1.default.taskExtract.findMany({
            where: { ...where, status: 'POSTED' },
            select: { receivedAt: true, updatedAt: true }
        });
        let totalReviewHours = 0;
        for (const e of postedExtracts) {
            totalReviewHours += (e.updatedAt.getTime() - e.receivedAt.getTime()) / (1000 * 60 * 60);
        }
        const avgReviewHours = postedExtracts.length > 0 ? Math.round(totalReviewHours / postedExtracts.length) : 0;
        // 3. Financial Summary
        const financial = await client_1.default.taskExtract.aggregate({
            where,
            _sum: { amount: true },
            _count: { id: true }
        });
        res.json({
            success: true,
            data: {
                contractorStats: contractorStats.filter(c => c.total > 0),
                avgReviewHours,
                totalAmount: Number(financial._sum.amount || 0),
                totalExtracts: financial._count.id
            }
        });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=report.routes.js.map