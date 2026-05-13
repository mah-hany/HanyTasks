import cron from 'node-cron';
import prisma from './prisma/client';
import { notificationService } from './modules/notifications/notification.service';
import { sendWeeklyReports } from './modules/email/email.service';
import { logger } from './utils/logger';
import https from 'https';

export function startSchedulers() {
  // ── Keep-Alive: ping self every 14 min ────────────────────
  const SELF_URL = process.env.APP_URL || 'https://hanytasks.onrender.com';
  cron.schedule('*/14 * * * *', () => {
    https.get(`${SELF_URL}/api/health`, (res) => {
      logger.debug(`🏓 Keep-alive ping → ${res.statusCode}`);
    }).on('error', (e) => {
      logger.warn('Keep-alive ping failed:', e.message);
    });
  });

  // ── Every 15 min: check overdue tasks ─────────────────────
  cron.schedule('*/15 * * * *', async () => {
    logger.debug('🕐 Running overdue task check...');
    try {
      const overdueTasks = await prisma.task.findMany({
        where: {
          status: { in: ['NEW', 'IN_PROGRESS', 'UNDER_REVIEW'] },
          dueDate: { lt: new Date() },
        },
        include: { assignedTo: true, createdBy: true },
      });

      for (const task of overdueTasks) {
        const recentNotif = await prisma.notification.findFirst({
          where: {
            taskId: task.id,
            type: 'TASK_OVERDUE',
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        if (!recentNotif) {
          await notificationService.create({
            receiverId: task.assignedToId,
            taskId: task.id,
            type: 'TASK_OVERDUE',
            title: 'Task Overdue',
            titleAr: 'المهمة متأخرة',
            message: `Task "${task.title}" is overdue!`,
            messageAr: `المهمة "${task.titleAr || task.title}" تجاوزت الموعد النهائي!`,
          });
          await notificationService.create({
            receiverId: task.createdById,
            taskId: task.id,
            type: 'TASK_OVERDUE',
            title: 'Task Overdue Alert',
            titleAr: 'تنبيه: مهمة متأخرة',
            message: `Task "${task.title}" assigned to ${task.assignedTo.fullName} is overdue`,
            messageAr: `المهمة "${task.titleAr || task.title}" المسندة إلى ${task.assignedTo.fullNameAr} متأخرة`,
          });
        }
      }
    } catch (err) {
      logger.error('Scheduler error:', err);
    }
  });

  // ── Daily at 8 AM: due-date reminders (1, 3 days) ──────
  cron.schedule('0 8 * * *', async () => {
    logger.debug('📅 Running due-date reminder check...');
    try {
      for (const days of [1, 3]) {
        const target = new Date();
        target.setDate(target.getDate() + days);
        const start = new Date(target.setHours(0, 0, 0, 0));
        const end   = new Date(target.setHours(23, 59, 59, 999));

        const tasks = await prisma.task.findMany({
          where: { status: { in: ['NEW', 'IN_PROGRESS', 'REVISION_REQUIRED'] }, dueDate: { gte: start, lte: end } },
          include: { assignedTo: true }
        });

        for (const task of tasks) {
          // 1. In-App Notification
          await notificationService.create({
            receiverId: task.assignedToId,
            taskId: task.id,
            type: 'TASK_ASSIGNED', // Change from SYSTEM to TASK_ASSIGNED to make it more noticeable
            title: `Task Due in ${days} Day${days > 1 ? 's' : ''}`,
            titleAr: `تذكير: المهمة تقترب من موعد التسليم (${days === 1 ? 'يتبقى 24 ساعة' : 'يتبقى 3 أيام'})`,
            message: `"${task.title}" is due in ${days} days`,
            messageAr: `"${task.titleAr || task.title}" ستنتهي خلال ${days === 1 ? 'يوم واحد' : '3 أيام'}. يرجى إنهائها في الموعد.`,
          });

          // 2. Email Notification
          if (task.assignedTo.email) {
            const { sendEmail, taskReminderEmail } = require('./modules/email/email.service');
            await sendEmail({
              to: task.assignedTo.email,
              subject: `⏰ تذكير بموعد المهمة: ${task.titleAr || task.title}`,
              html: taskReminderEmail(task.titleAr || task.title, task.taskCode, task.assignedTo.fullNameAr || task.assignedTo.fullName, days),
            });
          }

          // 3. Telegram Notification
          const { sendTelegramNotification } = require('./modules/telegram/telegram.bot');
          await sendTelegramNotification(
            task.assignedToId, 
            `⏰ *تذكير بموعد التسليم*\n\nالمهمة: *${task.taskCode}* - ${task.titleAr || task.title}\nالموعد: يتبقى *${days === 1 ? 'يوم واحد (24 ساعة)' : '3 أيام'}*\nيرجى سرعة الإنجاز.`
          );
        }
      }
    } catch (err) {
      logger.error('Daily reminder error:', err);
    }
  });

  // ── Weekly: email reports every Sunday 7 AM ───────────────
  cron.schedule('0 7 * * 0', async () => {
    logger.info('📧 Sending weekly email reports...');
    try {
      await sendWeeklyReports();
      logger.info('✅ Weekly reports sent');
    } catch (err) {
      logger.error('Weekly email error:', err);
    }
  });

  logger.info('⏰ Schedulers started: keep-alive + overdue + reminders + weekly email');
}
