"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.departmentService = void 0;
const client_1 = __importDefault(require("../../prisma/client"));
const errorHandler_1 = require("../../middleware/errorHandler");
exports.departmentService = {
    async getAll() {
        return client_1.default.department.findMany({
            include: {
                parent: { select: { id: true, name: true, nameAr: true } },
                children: { select: { id: true, name: true, nameAr: true } },
                manager: { select: { id: true, fullName: true, fullNameAr: true } },
                _count: { select: { users: true } },
            },
            orderBy: { name: 'asc' },
        });
    },
    async getTree() {
        const depts = await client_1.default.department.findMany({
            where: { isActive: true },
            include: {
                manager: { select: { id: true, fullName: true, fullNameAr: true } },
                _count: { select: { users: true } },
            },
        });
        const map = new Map();
        depts.forEach(d => map.set(d.id, { ...d, children: [] }));
        const roots = [];
        depts.forEach(d => {
            if (d.parentId && map.has(d.parentId)) {
                map.get(d.parentId).children.push(map.get(d.id));
            }
            else {
                roots.push(map.get(d.id));
            }
        });
        return roots;
    },
    async create(data) {
        return client_1.default.department.create({ data, include: { parent: true, manager: true } });
    },
    async update(id, data) {
        return client_1.default.department.update({ where: { id }, data });
    },
    async delete(id) {
        const hasUsers = await client_1.default.user.count({ where: { departmentId: id } });
        if (hasUsers > 0)
            throw new errorHandler_1.AppError('Cannot delete department with active users', 400);
        return client_1.default.department.update({ where: { id }, data: { isActive: false } });
    },
};
//# sourceMappingURL=department.service.js.map