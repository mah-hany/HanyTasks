"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSchedulers = startSchedulers;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = __importDefault(require("./prisma/client"));
const notification_service_1 = require("./modules/notifications/notification.service");
const email_service_1 = require("./modules/email/email.service");
const logger_1 = require("./utils/logger");
const https_1 = __importDefault(require("https"));
function startSchedulers() {
    // ── Keep-Alive: ping self every 14 min ────────────────────
    const SELF_URL = process.env.APP_URL || 'https://hanytasks.onrender.com';
    node_cron_1.default.schedule('*/14 * * * *', () => {
        https_1.default.get(`${SELF_URL}/api/health`, (res) => {
            logger_1.logger.debug(`🏓 Keep-alive ping → ${res.statusCode}`);
        }).on('error', (e) => {
            logger_1.logger.warn('Keep-alive ping failed:', e.message);
        });
    });
    // ── Every 15 min: check overdue tasks ─────────────────────
    node_cron_1.default.schedule('*/15 * * * *', async () => {
        logger_1.logger.debug('🕐 Running overdue task check...');
        try {
            const overdueTasks = await client_1.default.task.findMany({
                where: {
                    status: { in: ['NEW', 'IN_PROGRESS', 'UNDER_REVIEW'] },
                    dueDate: { lt: new Date() },
                },
                include: { assignedTo: true, createdBy: true },
            });
            for (const task of overdueTasks) {
                const recentNotif = await client_1.default.notification.findFirst({
                    where: {
                        taskId: task.id,
                        type: 'TASK_OVERDUE',
                        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                    },
                });
                if (!recentNotif) {
                    // Notify Assignee
                    await notification_service_1.notificationService.create({
                        receiverId: task.assignedToId,
                        taskId: task.id,
                        type: 'TASK_OVERDUE',
                        title: 'Task Overdue',
                        titleAr: 'المهمة متأخرة',
                        message: `Task "${task.title}" is overdue!`,
                        messageAr: `المهمة "${task.titleAr || task.title}" تجاوزت الموعد النهائي!`,
                    });
                    // Notify Task Creator
                    await notification_service_1.notificationService.create({
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
                        await notification_service_1.notificationService.create({
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
                        await sendTelegramNotification(task.assignedTo.managerId, `⚠️ *تنبيه تأخير للمدير*\n\nالمهمة: *${task.taskCode}* - ${task.titleAr || task.title}\nالموظف: *${task.assignedTo.fullNameAr}*\nهذه المهمة تجاوزت الموعد النهائي!`);
                    }
                }
            }
        }
        catch (err) {
            logger_1.logger.error('Scheduler error:', err);
        }
    });
    // 🌟 RULE 3: Daily at 9 AM: 3-days no update reminder
    node_cron_1.default.schedule('0 9 * * *', async () => {
        logger_1.logger.debug('⏳ Running 3-days no update check...');
        try {
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            const staleTasks = await client_1.default.task.findMany({
                where: {
                    status: { in: ['NEW', 'IN_PROGRESS'] },
                    updatedAt: { lt: threeDaysAgo },
                },
                include: { assignedTo: true }
            });
            for (const task of staleTasks) {
                // Send In-App Notification
                await notification_service_1.notificationService.create({
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
                await sendTelegramNotification(task.assignedToId, `🔔 *تذكير بتحديث حالة*\n\nالمهمة: *${task.taskCode}* - ${task.titleAr || task.title}\nلم يتم تحديثها منذ أكثر من 3 أيام. يرجى الدخول للنظام وتحديث حالة الإنجاز أو إضافة تعليق.`);
            }
        }
        catch (err) {
            logger_1.logger.error('No-update reminder error:', err);
        }
    });
    // ── Daily at 8 AM: due-date reminders (1, 3 days) ──────
    node_cron_1.default.schedule('0 8 * * *', async () => {
        logger_1.logger.debug('📅 Running due-date reminder check...');
        try {
            for (const days of [1, 3]) {
                const target = new Date();
                target.setDate(target.getDate() + days);
                const start = new Date(target.setHours(0, 0, 0, 0));
                const end = new Date(target.setHours(23, 59, 59, 999));
                const tasks = await client_1.default.task.findMany({
                    where: { status: { in: ['NEW', 'IN_PROGRESS', 'REVISION_REQUIRED'] }, dueDate: { gte: start, lte: end } },
                    include: { assignedTo: true }
                });
                for (const task of tasks) {
                    // 1. In-App Notification
                    await notification_service_1.notificationService.create({
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
                    await sendTelegramNotification(task.assignedToId, `⏰ *تذكير بموعد التسليم*\n\nالمهمة: *${task.taskCode}* - ${task.titleAr || task.title}\nالموعد: يتبقى *${days === 1 ? 'يوم واحد (24 ساعة)' : '3 أيام'}*\nيرجى سرعة الإنجاز.`);
                }
            }
        }
        catch (err) {
            logger_1.logger.error('Daily reminder error:', err);
        }
    });
    // ── Weekly: email reports every Sunday 7 AM ───────────────
    node_cron_1.default.schedule('0 7 * * 0', async () => {
        logger_1.logger.info('📧 Sending weekly email reports...');
        try {
            await (0, email_service_1.sendWeeklyReports)();
            logger_1.logger.info('✅ Weekly reports sent');
        }
        catch (err) {
            logger_1.logger.error('Weekly email error:', err);
        }
    });
    // ── Daily Manager Report at 5 PM ──────────────────────────
    node_cron_1.default.schedule('0 17 * * *', async () => {
        logger_1.logger.debug('📈 Running daily manager report...');
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            // Get all managers who have a telegram Chat ID
            const managers = await client_1.default.user.findMany({
                where: { role: { level: { lte: 2 } }, isActive: true, telegramChatId: { not: null } }
            });
            const [created, completed, overdue] = await Promise.all([
                client_1.default.task.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
                client_1.default.task.count({ where: { status: 'COMPLETED', completedDate: { gte: today, lt: tomorrow } } }),
                client_1.default.task.count({ where: { dueDate: { lt: today }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } })
            ]);
            const { sendTelegramNotification } = require('./modules/telegram/telegram.bot');
            for (const m of managers) {
                await sendTelegramNotification(m.id, `📈 *التقرير اليومي التلقائي*\n\n` +
                    `مرحباً ${m.fullNameAr}، إليك ملخص اليوم:\n` +
                    `🆕 مهام أُضيفت اليوم: *${created}*\n` +
                    `✅ مهام أُنجزت اليوم: *${completed}*\n` +
                    `⚠️ إجمالي المهام المتأخرة: *${overdue}*`);
            }
        }
        catch (err) {
            logger_1.logger.error('Daily manager report error:', err);
        }
    });
    logger_1.logger.info('⏰ Schedulers started: keep-alive + overdue + reminders + daily/weekly reports');
}
//# sourceMappingURL=schedulers.js.map