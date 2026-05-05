import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Roles ──────────────────────────────────────────────
  const roles = await Promise.all([
    prisma.role.upsert({ where: { name: 'SUPERADMIN' }, update: {}, create: { name: 'SUPERADMIN', nameAr: 'المشرف العام', level: 1 } }),
    prisma.role.upsert({ where: { name: 'ADMIN' },      update: {}, create: { name: 'ADMIN',      nameAr: 'مدير النظام',   level: 2 } }),
    prisma.role.upsert({ where: { name: 'MANAGER' },    update: {}, create: { name: 'MANAGER',    nameAr: 'مدير',          level: 3 } }),
    prisma.role.upsert({ where: { name: 'SUPERVISOR' }, update: {}, create: { name: 'SUPERVISOR', nameAr: 'مشرف',          level: 4 } }),
    prisma.role.upsert({ where: { name: 'EMPLOYEE' },   update: {}, create: { name: 'EMPLOYEE',   nameAr: 'موظف',          level: 5 } }),
  ]);
  console.log('✅ Roles created');

  const [superAdminRole, adminRole, managerRole, supervisorRole, employeeRole] = roles;

  // ── Permissions ────────────────────────────────────────
  const modules = ['USERS', 'TASKS', 'DEPARTMENTS', 'REPORTS', 'AUDIT', 'NOTIFICATIONS'];
  for (const role of roles) {
    for (const mod of modules) {
      const isSuperAdmin = role.level === 1;
      const isAdmin = role.level <= 2;
      const isManager = role.level <= 3;
      await prisma.permission.upsert({
        where: { roleId_module: { roleId: role.id, module: mod } },
        update: {},
        create: {
          roleId: role.id, module: mod,
          canCreate: isManager, canRead: true,
          canUpdate: isManager, canDelete: isAdmin,
          canAssign: isManager, canReport: isManager,
        },
      });
    }
  }
  console.log('✅ Permissions created');

  // ── Departments ────────────────────────────────────────
  const hrDept = await prisma.department.upsert({
    where: { code: 'DEP-HR' }, update: {},
    create: { name: 'Human Resources', nameAr: 'الموارد البشرية', code: 'DEP-HR' },
  });
  const itDept = await prisma.department.upsert({
    where: { code: 'DEP-IT' }, update: {},
    create: { name: 'Information Technology', nameAr: 'تقنية المعلومات', code: 'DEP-IT' },
  });
  const financeDept = await prisma.department.upsert({
    where: { code: 'DEP-FIN' }, update: {},
    create: { name: 'Finance', nameAr: 'المالية', code: 'DEP-FIN' },
  });
  const marketingDept = await prisma.department.upsert({
    where: { code: 'DEP-MKT' }, update: {},
    create: { name: 'Marketing', nameAr: 'التسويق', code: 'DEP-MKT' },
  });
  console.log('✅ Departments created');

  // ── Task Categories ────────────────────────────────────
  const categories = [
    { name: 'IT', nameAr: 'تقنية المعلومات', color: '#2E86AB', icon: 'computer' },
    { name: 'HR', nameAr: 'موارد بشرية', color: '#A23B72', icon: 'people' },
    { name: 'Finance', nameAr: 'مالية', color: '#F18F01', icon: 'attach_money' },
    { name: 'Marketing', nameAr: 'تسويق', color: '#C73E1D', icon: 'campaign' },
    { name: 'Admin', nameAr: 'إدارية', color: '#1E3A5F', icon: 'business' },
    { name: 'Other', nameAr: 'أخرى', color: '#6B6B6B', icon: 'category' },
  ];
  for (const cat of categories) {
    await prisma.taskCategory.upsert({
      where: { id: categories.indexOf(cat) + 1 },
      update: {},
      create: cat,
    }).catch(() => prisma.taskCategory.create({ data: cat }));
  }
  console.log('✅ Task categories created');

  // ── Super Admin User ───────────────────────────────────
  const superAdminExists = await prisma.user.findUnique({ where: { username: 'superadmin' } });
  if (!superAdminExists) {
    await prisma.user.create({
      data: {
        employeeCode: 'EMP-2026-001',
        fullName: 'Super Administrator',
        fullNameAr: 'المشرف العام',
        username: 'superadmin',
        email: 'superadmin@taskflow.pro',
        passwordHash: await bcrypt.hash('Admin@2026', 12),
        roleId: superAdminRole.id,
        departmentId: itDept.id,
        isFirstLogin: false,
        isActive: true,
      },
    });
    console.log('✅ SuperAdmin created: superadmin / Admin@2026');
  }

  // ── Demo Manager ──────────────────────────────────────
  const managerExists = await prisma.user.findUnique({ where: { username: 'manager1' } });
  if (!managerExists) {
    await prisma.user.create({
      data: {
        employeeCode: 'EMP-2026-002',
        fullName: 'Ahmed Mansour',
        fullNameAr: 'أحمد منصور',
        username: 'manager1',
        email: 'ahmed@taskflow.pro',
        passwordHash: await bcrypt.hash('Manager@2026', 12),
        roleId: managerRole.id,
        departmentId: itDept.id,
        isFirstLogin: false,
        isActive: true,
      },
    });
    console.log('✅ Demo Manager created: manager1 / Manager@2026');
  }

  // ── Demo Employee ─────────────────────────────────────
  const employeeExists = await prisma.user.findUnique({ where: { username: 'emp1' } });
  if (!employeeExists) {
    const manager = await prisma.user.findUnique({ where: { username: 'manager1' } });
    await prisma.user.create({
      data: {
        employeeCode: 'EMP-2026-003',
        fullName: 'Sara Hassan',
        fullNameAr: 'سارة حسن',
        username: 'emp1',
        email: 'sara@taskflow.pro',
        passwordHash: await bcrypt.hash('Emp@2026', 12),
        roleId: employeeRole.id,
        departmentId: itDept.id,
        managerId: manager?.id,
        isFirstLogin: false,
        isActive: true,
      },
    });
    console.log('✅ Demo Employee created: emp1 / Emp@2026');
  }

  // ── System Settings ───────────────────────────────────
  const defaults = [
    { key: 'app_name', value: 'TaskFlow Pro' },
    { key: 'default_lang', value: 'ar' },
    { key: 'alert_before_days', value: '3' },
    { key: 'max_failed_logins', value: '3' },
    { key: 'lockout_minutes', value: '5' },
  ];
  for (const s of defaults) {
    await prisma.systemSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  console.log('🎉 Database seeded successfully!');
  console.log('\nDemo Accounts:');
  console.log('  SuperAdmin: superadmin / Admin@2026');
  console.log('  Manager:    manager1   / Manager@2026');
  console.log('  Employee:   emp1       / Emp@2026');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
