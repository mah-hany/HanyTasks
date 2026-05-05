"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = __importDefault(require("../../prisma/client"));
const errorHandler_1 = require("../../middleware/errorHandler");
function generateEmployeeCode() {
    const year = new Date().getFullYear();
    return `EMP-${year}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}
exports.userService = {
    async getAll(filters) {
        const where = {};
        if (filters.departmentId)
            where.departmentId = filters.departmentId;
        if (filters.roleId)
            where.roleId = filters.roleId;
        if (filters.isActive !== undefined)
            where.isActive = filters.isActive;
        if (filters.search) {
            where.OR = [
                { fullName: { contains: filters.search, mode: 'insensitive' } },
                { fullNameAr: { contains: filters.search, mode: 'insensitive' } },
                { employeeCode: { contains: filters.search, mode: 'insensitive' } },
                { username: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        return client_1.default.user.findMany({
            where,
            select: {
                id: true, employeeCode: true, fullName: true, fullNameAr: true,
                username: true, email: true, phone: true, profilePhoto: true,
                isActive: true, createdAt: true, lastLoginAt: true,
                role: { select: { id: true, name: true, nameAr: true, level: true } },
                department: { select: { id: true, name: true, nameAr: true } },
                manager: { select: { id: true, fullName: true, fullNameAr: true, employeeCode: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    },
    async getById(id) {
        const user = await client_1.default.user.findUnique({
            where: { id },
            include: {
                role: true,
                department: true,
                manager: { select: { id: true, fullName: true, fullNameAr: true, employeeCode: true } },
                subordinates: { select: { id: true, fullName: true, fullNameAr: true, employeeCode: true } },
                tasksAssigned: {
                    where: { status: { not: 'COMPLETED' } },
                    include: { category: true },
                    take: 10,
                },
            },
        });
        if (!user)
            throw new errorHandler_1.AppError('User not found', 404);
        const { passwordHash, ...safe } = user;
        return safe;
    },
    async create(data) {
        // Generate unique code
        let employeeCode;
        let attempts = 0;
        do {
            employeeCode = generateEmployeeCode();
            const exists = await client_1.default.user.findUnique({ where: { employeeCode } });
            if (!exists)
                break;
            attempts++;
        } while (attempts < 10);
        const passwordHash = await bcryptjs_1.default.hash(data.password || 'TaskFlow@2026', 12);
        const user = await client_1.default.user.create({
            data: {
                employeeCode,
                fullName: data.fullName,
                fullNameAr: data.fullNameAr,
                username: data.username,
                email: data.email,
                phone: data.phone,
                departmentId: data.departmentId,
                roleId: data.roleId,
                managerId: data.managerId,
                passwordHash,
                isFirstLogin: true,
            },
            include: { role: true, department: true },
        });
        await client_1.default.auditLog.create({
            data: { action: 'CREATE_USER', tableAffected: 'tbl_Users', recordId: user.id },
        });
        const { passwordHash: _, ...safe } = user;
        return safe;
    },
    async update(id, data) {
        const user = await client_1.default.user.update({
            where: { id },
            data,
            include: { role: true, department: true },
        });
        await client_1.default.auditLog.create({
            data: { action: 'UPDATE_USER', tableAffected: 'tbl_Users', recordId: id },
        });
        const { passwordHash, ...safe } = user;
        return safe;
    },
    async resetPassword(id, newPassword) {
        const hash = await bcryptjs_1.default.hash(newPassword, 12);
        await client_1.default.user.update({ where: { id }, data: { passwordHash: hash, isFirstLogin: true } });
        return { message: 'Password reset successfully' };
    },
    async transfer(userId, toDeptId, note, transferredById) {
        const user = await client_1.default.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new errorHandler_1.AppError('User not found', 404);
        await client_1.default.employeeTransfer.create({
            data: { userId, fromDeptId: user.departmentId, toDeptId, note, transferredById },
        });
        return client_1.default.user.update({ where: { id: userId }, data: { departmentId: toDeptId } });
    },
    async getOrgTree() {
        const users = await client_1.default.user.findMany({
            where: { isActive: true },
            select: {
                id: true, employeeCode: true, fullName: true, fullNameAr: true,
                profilePhoto: true, managerId: true,
                role: { select: { name: true, nameAr: true, level: true } },
                department: { select: { name: true, nameAr: true } },
            },
            orderBy: { id: 'asc' },
        });
        // Build tree
        const map = new Map();
        users.forEach(u => map.set(u.id, { ...u, children: [] }));
        const roots = [];
        users.forEach(u => {
            if (u.managerId && map.has(u.managerId)) {
                map.get(u.managerId).children.push(map.get(u.id));
            }
            else {
                roots.push(map.get(u.id));
            }
        });
        return roots;
    },
    async delete(id) {
        const user = await client_1.default.user.findUnique({ where: { id } });
        if (!user)
            throw new errorHandler_1.AppError('User not found', 404);
        // Cannot delete SuperAdmin
        if (user.roleId === 1)
            throw new errorHandler_1.AppError('Cannot delete SuperAdmin', 403);
        try {
            // First, delete notifications where this user is sender or receiver (since Prisma might not cascade)
            await client_1.default.notification.deleteMany({ where: { OR: [{ receiverId: id }, { senderId: id }] } });
            // Delete user
            await client_1.default.user.delete({ where: { id } });
            return { message: 'User deleted successfully' };
        }
        catch (error) {
            if (error.code === 'P2003') {
                throw new errorHandler_1.AppError('Cannot delete this user because they are linked to tasks, comments, or other records. Deactivate them instead.', 400);
            }
            throw error;
        }
    },
};
//# sourceMappingURL=user.service.js.map