"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTelegramBot = initTelegramBot;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const client_1 = __importDefault(require("../../prisma/client"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
function initTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN || '7808940555:AAFvtJAdJFaaqV47_htRkRvdb97ub0duC_c';
    if (!token)
        return;
    const bot = new node_telegram_bot_api_1.default(token, { polling: true });
    const pendingAuth = new Map(); // chatId -> username
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text?.trim() || '';
        // Check if user is already authenticated
        const user = await client_1.default.user.findUnique({ where: { telegramChatId: String(chatId) }, include: { role: true } });
        if (!user) {
            // User is not authenticated
            if (text.startsWith('/start')) {
                bot.sendMessage(chatId, 'مرحباً بك في المساعد الذكي لنظام TaskFlow Pro! 🚀\nالرجاء إدخال اسم المستخدم (Username) للتحقق من هويتك:');
                return;
            }
            if (!pendingAuth.has(chatId)) {
                // Assume this is the username
                const foundUser = await client_1.default.user.findUnique({ where: { username: text }, include: { role: true } });
                if (!foundUser || foundUser.role.level !== 1) {
                    bot.sendMessage(chatId, 'عذراً، هذا الحساب غير موجود أو ليس لديه صلاحيات المشرف العام.');
                    return;
                }
                pendingAuth.set(chatId, text);
                bot.sendMessage(chatId, 'تم العثور على الحساب. يرجى إدخال كلمة المرور (Password):');
                return;
            }
            else {
                // Assume this is the password
                const username = pendingAuth.get(chatId);
                const foundUser = await client_1.default.user.findUnique({ where: { username } });
                if (!foundUser)
                    return;
                const isMatch = await bcryptjs_1.default.compare(text, foundUser.passwordHash);
                if (isMatch) {
                    await client_1.default.user.update({
                        where: { id: foundUser.id },
                        data: { telegramChatId: String(chatId) }
                    });
                    pendingAuth.delete(chatId);
                    bot.sendMessage(chatId, `تم التحقق بنجاح! مرحباً بك ${foundUser.fullNameAr}. 🎉\nيمكنك الآن سؤالي عن أي شيء يخص النظام.`);
                    bot.sendMessage(chatId, 'يمكنك تجربة الأوامر التالية:\n- "كم عدد المهام؟"\n- "المهام المتأخرة"\n- "نسبة الانجاز"\n- "احصائيات النظام"');
                }
                else {
                    bot.sendMessage(chatId, 'كلمة المرور غير صحيحة. يرجى إرسال اسم المستخدم للبدء من جديد.');
                    pendingAuth.delete(chatId);
                }
                return;
            }
        }
        // User is authenticated
        if (text === '/start') {
            bot.sendMessage(chatId, `مرحباً بعودتك ${user.fullNameAr}! أنا جاهز لأي استفسار حول TaskFlow Pro.`);
            return;
        }
        // Keyword based AI
        if (text.includes('احصائيات') || text.includes('نسبة') || text.includes('عدد المهام')) {
            const stats = await getSystemStats();
            bot.sendMessage(chatId, `📊 **إحصائيات النظام العامة:**\n\n- إجمالي المهام: ${stats.totalTasks}\n- المهام المكتملة: ${stats.completedTasks} ✅\n- المهام المتأخرة: ${stats.overdueTasks} ⚠️\n- نسبة الإنجاز: ${stats.completionRate}%\n- عدد الموظفين: ${stats.totalEmployees}`);
        }
        else if (text.includes('تأخير') || text.includes('متأخرة')) {
            const overdue = await getOverdueTasks();
            if (overdue.length === 0) {
                bot.sendMessage(chatId, 'ممتاز! لا يوجد أي مهام متأخرة حالياً في النظام. 🎉');
            }
            else {
                let msgStr = `⚠️ يوجد ${overdue.length} مهام متأخرة:\n\n`;
                overdue.slice(0, 10).forEach(t => {
                    msgStr += `- ${t.taskCode}: ${t.titleAr || t.title} (للموظف: ${t.assignedTo.fullNameAr})\n`;
                });
                if (overdue.length > 10)
                    msgStr += `\n... وهناك ${overdue.length - 10} مهام أخرى متأخرة.`;
                bot.sendMessage(chatId, msgStr);
            }
        }
        else if (text.includes('موظفين')) {
            const activeUsers = await client_1.default.user.count({ where: { isActive: true } });
            bot.sendMessage(chatId, `👥 يوجد حالياً ${activeUsers} موظفين نشطين في النظام.`);
        }
        else {
            bot.sendMessage(chatId, 'عذراً، لم أفهم سؤالك. يمكنك سؤالي عن: "الاحصائيات"، "المهام المتأخرة"، أو "عدد الموظفين". وسيتم ربطي بنموذج ذكاء اصطناعي قريباً للإجابة بشكل أفضل! 🤖');
        }
    });
    console.log('Telegram Bot initialized and polling...');
}
async function getSystemStats() {
    const totalTasks = await client_1.default.task.count();
    const completedTasks = await client_1.default.task.count({ where: { status: 'COMPLETED' } });
    const today = new Date();
    const overdueTasks = await client_1.default.task.count({
        where: { dueDate: { lt: today }, status: { not: 'COMPLETED' } }
    });
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const totalEmployees = await client_1.default.user.count();
    return { totalTasks, completedTasks, overdueTasks, completionRate, totalEmployees };
}
async function getOverdueTasks() {
    const today = new Date();
    return client_1.default.task.findMany({
        where: { dueDate: { lt: today }, status: { not: 'COMPLETED' } },
        include: { assignedTo: true },
        orderBy: { dueDate: 'asc' }
    });
}
//# sourceMappingURL=telegram.bot.js.map