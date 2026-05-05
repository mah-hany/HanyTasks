import prisma from '../../prisma/client';
import { AppError } from '../../middleware/errorHandler';

export const departmentService = {
  async getAll() {
    return prisma.department.findMany({
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
    const depts = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        manager: { select: { id: true, fullName: true, fullNameAr: true } },
        _count: { select: { users: true } },
      },
    });

    const map = new Map<number, any>();
    depts.forEach(d => map.set(d.id, { ...d, children: [] }));
    const roots: any[] = [];
    depts.forEach(d => {
      if (d.parentId && map.has(d.parentId)) {
        map.get(d.parentId).children.push(map.get(d.id));
      } else {
        roots.push(map.get(d.id));
      }
    });
    return roots;
  },

  async create(data: { name: string; nameAr: string; code: string; parentId?: number; managerId?: number }) {
    return prisma.department.create({ data, include: { parent: true, manager: true } });
  },

  async update(id: number, data: any) {
    return prisma.department.update({ where: { id }, data });
  },

  async delete(id: number) {
    const hasUsers = await prisma.user.count({ where: { departmentId: id } });
    if (hasUsers > 0) throw new AppError('Cannot delete department with active users', 400);
    return prisma.department.update({ where: { id }, data: { isActive: false } });
  },
};
