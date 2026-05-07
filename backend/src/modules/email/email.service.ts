import nodemailer from 'nodemailer';
import prisma from '../../prisma/client';

// الإيميل الثابت للنظام
const SYSTEM_EMAIL = 'gift.give.me.gift@gmail.com';
const SYSTEM_NAME  = 'Hany Tasks — نظام إدارة المهام';

let transporter: nodemailer.Transporter | null = null;

export function initEmailService() {
  const pass = process.env.SMTP_PASS;

  if (!pass) {
    console.warn('⚠️  SMTP_PASS not set — email notifications disabled');
    return;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: +(process.env.SMTP_PORT || 587),
    secure: false, // TLS
    auth: {
      user: SYSTEM_EMAIL,
      pass,
    },
  });

  console.log(`✅ Email service initialized — sender: ${SYSTEM_EMAIL}`);
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: `"${SYSTEM_NAME}" <${SYSTEM_EMAIL}>`,
      ...options,
    });
  } catch (err: any) {
    console.error('Email send failed:', err.message);
  }
}

// ── Email Templates ──────────────────────────────────────────
export function taskAssignedEmail(taskTitle: string, taskCode: string, employeeName: string, dueDate?: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>مهمة جديدة</title></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;padding:20px;direction:rtl">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:30px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">Hany Tasks</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0">نظام إدارة المهام</p>
    </div>
    <div style="padding:30px">
      <h2 style="color:#1e293b;margin-top:0">مرحباً ${employeeName}،</h2>
      <p style="color:#475569;font-size:16px;line-height:1.6">تم إسناد مهمة جديدة إليك:</p>
      <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0">
        <p style="margin:0 0 8px"><strong>📋 المهمة:</strong> ${taskTitle}</p>
        <p style="margin:0 0 8px"><strong>🔖 الكود:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px">${taskCode}</code></p>
        ${dueDate ? `<p style="margin:0"><strong>📅 الموعد النهائي:</strong> ${dueDate}</p>` : ''}
      </div>
      <p style="color:#475569">يرجى الاطلاع على تفاصيل المهمة وبدء العمل في أقرب وقت ممكن.</p>
      <div style="text-align:center;margin-top:30px">
        <a href="${process.env.APP_URL || 'https://hany-tasks.vercel.app'}/tasks"
           style="background:#f97316;color:#fff;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
          عرض المهمة
        </a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px;text-align:center;color:#94a3b8;font-size:12px">
      © ${new Date().getFullYear()} Hany Tasks — نظام إدارة المهام
    </div>
  </div>
</body>
</html>`;
}

export function weeklyReportEmail(employeeName: string, stats: {
  total: number; completed: number; overdue: number; rate: number;
}): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>التقرير الأسبوعي</title></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;padding:20px;direction:rtl">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:30px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">📊 التقرير الأسبوعي</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0">${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div style="padding:30px">
      <h2 style="color:#1e293b;margin-top:0">مرحباً ${employeeName}،</h2>
      <p style="color:#475569">هذا ملخص أدائك خلال الأسبوع الماضي:</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0">
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:32px;font-weight:800;color:#16a34a">${stats.completed}</div>
          <div style="color:#15803d;font-size:14px">مهام مكتملة</div>
        </div>
        <div style="background:#fff7ed;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:32px;font-weight:800;color:#ea580c">${stats.overdue}</div>
          <div style="color:#c2410c;font-size:14px">مهام متأخرة</div>
        </div>
        <div style="background:#eff6ff;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:32px;font-weight:800;color:#2563eb">${stats.total}</div>
          <div style="color:#1d4ed8;font-size:14px">إجمالي المهام</div>
        </div>
        <div style="background:#fdf4ff;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:32px;font-weight:800;color:#9333ea">${stats.rate}%</div>
          <div style="color:#7e22ce;font-size:14px">نسبة الإنجاز</div>
        </div>
      </div>
      <div style="text-align:center;margin-top:30px">
        <a href="${process.env.APP_URL || 'https://hany-tasks.vercel.app'}/tasks"
           style="background:#6366f1;color:#fff;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
          عرض مهامي
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Weekly Report Scheduler (called from schedulers.ts) ──────
export async function sendWeeklyReports() {
  if (!transporter) return;

  const users = await prisma.user.findMany({
    where: { isActive: true, email: { not: '' } },
  });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const user of users) {
    try {
      const [total, completed, overdue] = await Promise.all([
        prisma.task.count({ where: { assignedToId: user.id } }),
        prisma.task.count({ where: { assignedToId: user.id, status: 'COMPLETED', completedDate: { gte: weekAgo } } }),
        prisma.task.count({ where: { assignedToId: user.id, dueDate: { lt: now }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      ]);
      const rate = total > 0 ? Math.round(completed / total * 100) : 0;

      await sendEmail({
        to: user.email,
        subject: `📊 تقريرك الأسبوعي - Hany Tasks`,
        html: weeklyReportEmail(user.fullNameAr || user.fullName, { total, completed, overdue, rate }),
      });
    } catch (e: any) {
      console.error(`Weekly report failed for ${user.email}:`, e.message);
    }
  }
}
