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
                    await notification_service_1.notificationService.create({
                        receiverId: task.assignedToId,
                        taskId: task.id,
                        type: 'TASK_OVERDUE',
                        title: 'Task Overdue',
                        titleAr: 'المهمة متأخرة',
                        message: `Task "${task.title}" is overdue!`,
                        messageAr: `المهمة "${task.titleAr || task.title}" تجاوزت الموعد النهائي!`,
                    });
                    await notification_service_1.notificationService.create({
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
        }
        catch (err) {
            logger_1.logger.error('Scheduler error:', err);
        }
    });
    // ── Daily at 8 AM: due-date reminders (1, 3, 7 days) ──────
    node_cron_1.default.schedule('0 8 * * *', async () => {
        logger_1.logger.debug('📅 Running due-date reminder check...');
        try {
            for (const days of [1, 3, 7]) {
                const target = new Date();
                target.setDate(target.getDate() + days);
                const start = new Date(target.setHours(0, 0, 0, 0));
                const end = new Date(target.setHours(23, 59, 59, 999));
                const tasks = await client_1.default.task.findMany({
                    where: { status: { in: ['NEW', 'IN_PROGRESS'] }, dueDate: { gte: start, lte: end } },
                });
                for (const task of tasks) {
                    await notification_service_1.notificationService.create({
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
    logger_1.logger.info('⏰ Schedulers started: keep-alive + overdue + reminders + weekly email');
}
//# sourceMappingURL=schedulers.js.map