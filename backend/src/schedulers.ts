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
          // Notify Assignee
          await notificationService.create({
            receiverId: task.assignedToId,
            taskId: task.id,
            type: 'TASK_OVERDUE',
            title: 'Task Overdue',
            titleAr: 'المهمة متأخرة',
            message: `Task "${task.title}" is overdue!`,
            messageAr: `المهمة "${task.titleAr || task.title}" تجاوزت الموعد النهائي!`,
          });
          // Notify Task Creator
          await notificationService.create({
            receiverId: task.createdById,
            taskId: task.id,
            type: 'TASK_OVERDUE',
            title: 'Task Overdue Alert',
            titleAr: 'تنبيه: مهمة متأخرة',
            message: `Task "${task.title}" assigned to ${task.assignedTo.fullName} is overdue`,
            messageAr: `المهمة "${task.titleAr || task.title}" المسندة إلى ${task.assignedTo.fullNameAr} متأخرة`,
          });

          // 🌟 RULE 1: Notify Manager Automatically
          if (task.assignedTo.managerId) {
            await notificationService.create({
              receiverId: task.assignedTo.managerId,
              taskId: task.id,
              type: 'TASK_OVERDUE',
              title: 'تنبيه تأخير تلقائي (إدارة)',
              titleAr: 'تنبيه تأخير تلقائي (للمدير المباشر)',
              message: `Task "${task.title}" assigned to your team member is overdue`,
              messageAr: `المهمة "${task.titleAr || task.title}" المسندة للموظف ${task.assignedTo.fullNameAr} تجاوزت موعد التسليم.`,
            });
            // Also send Telegram to manager
            const { sendTelegramNotification } = require('./modules/telegram/telegram.bot');
            await sendTelegramNotification(
              task.assignedTo.managerId,
              `⚠️ *تنبيه تأخير للمدير*\n\nالمهمة: *${task.taskCode}* - ${task.titleAr || task.title}\nالموظف: *${task.assignedTo.fullNameAr}*\nهذه المهمة تجاوزت الموعد النهائي!`
            );
          }
        }
      }
    } catch (err) {
      logger.error('Scheduler error:', err);
    }
  });

  // 🌟 RULE 3: Daily at 9 AM: 3-days no update reminder
  cron.schedule('0 9 * * *', async () => {
    logger.debug('⏳ Running 3-days no update check...');
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const staleTasks = await prisma.task.findMany({
        where: {
          status: { in: ['NEW', 'IN_PROGRESS'] },
          updatedAt: { lt: threeDaysAgo },
        },
        include: { assignedTo: true }
      });

      for (const task of staleTasks) {
        // Send In-App Notification
        await notificationService.create({
          receiverId: task.assignedToId,
          taskId: task.id,
          type: 'SYSTEM',
          title: 'تحديث مطلوب للمهمة',
          titleAr: 'تحديث مطلوب للمهمة',
          message: `Task "${task.title}" has not been updated for 3 days`,
          messageAr: `المهمة "${task.titleAr || task.title}" لم يتم تحديث حالتها منذ 3 أيام. يرجى المتابعة وتحديث التطورات.`,
        });
        
        // Send Telegram reminder
        const { sendTelegramNotification } = require('./modules/telegram/telegram.bot');
        await sendTelegramNotification(
          task.assignedToId,
          `🔔 *تذكير بتحديث حالة*\n\nالمهمة: *${task.taskCode}* - ${task.titleAr || task.title}\nلم يتم تحديثها منذ أكثر من 3 أيام. يرجى الدخول للنظام وتحديث حالة الإنجاز أو إضافة تعليق.`
        );
      }
    } catch (err) {
      logger.error('No-update reminder error:', err);
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
