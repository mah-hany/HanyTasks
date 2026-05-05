import cron from 'node-cron';
import prisma from './prisma/client';
import { notificationService } from './modules/notifications/notification.service';
import { logger } from './utils/logger';

export function startSchedulers() {
  // Run every 15 minutes — check for overdue tasks
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
        // Check if overdue notification already sent today
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
          // Notify creator too
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

  // Run daily at 8:00 AM — check tasks due in 1, 3, 7 days
  cron.schedule('0 8 * * *', async () => {
    logger.debug('📅 Running due-date reminder check...');
    try {
      for (const days of [1, 3, 7]) {
        const target = new Date();
        target.setDate(target.getDate() + days);
        const start = new Date(target.setHours(0, 0, 0, 0));
        const end = new Date(target.setHours(23, 59, 59, 999));

        const tasks = await prisma.task.findMany({
          where: {
            status: { in: ['NEW', 'IN_PROGRESS'] },
            dueDate: { gte: start, lte: end },
          },
        });

        for (const task of tasks) {
          await notificationService.create({
            receiverId: task.assignedToId,
            taskId: task.id,
            type: 'SYSTEM',
            title: `Task Due in ${days} Day${days > 1 ? 's' : ''}`,
            titleAr: `المهمة ستنتهي خلال ${days} ${days === 1 ? 'يوم' : 'أيام'}`,
            message: `"${task.title}" is due in ${days} days`,
            messageAr: `"${task.titleAr || task.title}" ستنتهي خلال ${days} ${days === 1 ? 'يوم' : 'أيام'}`,
          });
        }
      }
    } catch (err) {
      logger.error('Daily reminder error:', err);
    }
  });

  logger.info('⏰ Schedulers started');
}
