import TelegramBot from 'node-telegram-bot-api';
import prisma from '../../prisma/client';
import bcrypt from 'bcryptjs';

export function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN || '7808940555:AAFvtJAdJFaaqV47_htRkRvdb97ub0duC_c';
  if (!token) return;

  const bot = new TelegramBot(token, { polling: true });
  const pendingAuth = new Map<number, string>(); // chatId -> username

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim() || '';

    // Check if user is already authenticated
    const user = await prisma.user.findUnique({ where: { telegramChatId: String(chatId) }, include: { role: true } });

    if (!user) {
      // User is not authenticated
      if (text.startsWith('/start')) {
        bot.sendMessage(chatId, 'مرحباً بك في المساعد الذكي لنظام TaskFlow Pro! 🚀\nالرجاء إدخال اسم المستخدم (Username) للتحقق من هويتك:');
        return;
      }

      if (!pendingAuth.has(chatId)) {
        // Assume this is the username
        const foundUser = await prisma.user.findFirst({ 
          where: { username: { equals: text, mode: 'insensitive' } }, 
          include: { role: true } 
        });
        if (!foundUser || (!foundUser.role.name.toLowerCase().includes('super') && foundUser.role.level > 1)) {
          bot.sendMessage(chatId, 'عذراً، هذا الحساب غير موجود أو ليس لديه صلاحيات المشرف العام.');
          return;
        }
        pendingAuth.set(chatId, text);
        bot.sendMessage(chatId, 'تم العثور على الحساب. يرجى إدخال كلمة المرور (Password):');
        return;
      } else {
        // Assume this is the password
        const username = pendingAuth.get(chatId)!;
        const foundUser = await prisma.user.findUnique({ where: { username } });
        if (!foundUser) return;

        const isMatch = await bcrypt.compare(text, foundUser.passwordHash);
        if (isMatch) {
          await prisma.user.update({
            where: { id: foundUser.id },
            data: { telegramChatId: String(chatId) }
          });
          pendingAuth.delete(chatId);
          bot.sendMessage(chatId, `تم التحقق بنجاح! مرحباً بك ${foundUser.fullNameAr}. 🎉\nيمكنك الآن سؤالي عن أي شيء يخص النظام.`);
          bot.sendMessage(chatId, 'يمكنك تجربة الأوامر التالية:\n- "كم عدد المهام؟"\n- "المهام المتأخرة"\n- "نسبة الانجاز"\n- "احصائيات النظام"');
        } else {
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
    } else if (text.includes('تأخير') || text.includes('متأخرة')) {
      const overdue = await getOverdueTasks();
      if (overdue.length === 0) {
        bot.sendMessage(chatId, 'ممتاز! لا يوجد أي مهام متأخرة حالياً في النظام. 🎉');
      } else {
        let msgStr = `⚠️ يوجد ${overdue.length} مهام متأخرة:\n\n`;
        overdue.slice(0, 10).forEach(t => {
          msgStr += `- ${t.taskCode}: ${t.titleAr || t.title} (للموظف: ${t.assignedTo.fullNameAr})\n`;
        });
        if (overdue.length > 10) msgStr += `\n... وهناك ${overdue.length - 10} مهام أخرى متأخرة.`;
        bot.sendMessage(chatId, msgStr);
      }
    } else if (text.includes('موظفين')) {
      const activeUsers = await prisma.user.count({ where: { isActive: true } });
      bot.sendMessage(chatId, `👥 يوجد حالياً ${activeUsers} موظفين نشطين في النظام.`);
    } else {
      bot.sendMessage(chatId, 'عذراً، لم أفهم سؤالك. يمكنك سؤالي عن: "الاحصائيات"، "المهام المتأخرة"، أو "عدد الموظفين". وسيتم ربطي بنموذج ذكاء اصطناعي قريباً للإجابة بشكل أفضل! 🤖');
    }
  });

  console.log('Telegram Bot initialized and polling...');
}

async function getSystemStats() {
  const totalTasks = await prisma.task.count();
  const completedTasks = await prisma.task.count({ where: { status: 'COMPLETED' } });
  
  const today = new Date();
  const overdueTasks = await prisma.task.count({
    where: { dueDate: { lt: today }, status: { not: 'COMPLETED' } }
  });

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalEmployees = await prisma.user.count();

  return { totalTasks, completedTasks, overdueTasks, completionRate, totalEmployees };
}

async function getOverdueTasks() {
  const today = new Date();
  return prisma.task.findMany({
    where: { dueDate: { lt: today }, status: { not: 'COMPLETED' } },
    include: { assignedTo: true },
    orderBy: { dueDate: 'asc' }
  });
}
