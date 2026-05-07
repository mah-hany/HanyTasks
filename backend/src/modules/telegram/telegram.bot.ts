import TelegramBot from 'node-telegram-bot-api';
import prisma from '../../prisma/client';
import bcrypt from 'bcryptjs';
import https from 'https';

// State machine for conversations
const pendingAuth = new Map<number, string>(); // chatId -> username (waiting for password)
const awaitingUsername = new Set<number>();    // chatIds waiting for username input
const sessionState = new Map<number, string>(); // chatId -> current state e.g. 'awaiting_task_code'

// Singleton guard - prevent multiple bot instances
let botInstance: TelegramBot | null = null;

/** Delete any registered Telegram webhook via raw HTTPS before starting polling */
function deleteWebhookRaw(token: string): Promise<void> {
  return new Promise((resolve) => {
    const url = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('Webhook deleted:', data);
        resolve();
      });
    }).on('error', (e) => {
      console.warn('Could not delete webhook (will continue):', e.message);
      resolve();
    });
  });
}

export async function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN || '7808940555:AAFvtJAdJFaaqV47_htRkRvdb97ub0duC_c';
  if (!token) { console.warn('No TELEGRAM_BOT_TOKEN set'); return; }
  if (botInstance) { console.log('Telegram Bot already initialized.'); return; }

  try {
    // Step 1: Delete any old webhook first (raw HTTPS - most reliable)
    await deleteWebhookRaw(token);

    // Step 2: Create bot with polling enabled
    const bot = new TelegramBot(token, {
      polling: {
        interval: 1000,
        autoStart: true,
        params: { timeout: 10, allowed_updates: ['message', 'callback_query'] }
      }
    });

    botInstance = bot;
    console.log('✅ Telegram Bot initialized and polling started.');

    // Handle polling errors gracefully
    bot.on('polling_error', (err: any) => {
      const msg = err.message || String(err);
      if (msg.includes('409')) {
        console.warn('⚠️ Telegram 409 conflict - stopping bot and restarting in 5s...');
        bot.stopPolling().then(() => {
          botInstance = null;
          setTimeout(() => initTelegramBot(), 5000);
        });
      } else if (msg.includes('EFATAL') || msg.includes('ECONNRESET')) {
        console.warn('⚠️ Telegram connection reset, will auto-retry...');
      } else {
        console.error('Telegram polling error:', msg);
      }
    });

  // ── /start command ────────────────────────────────────────
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await getAuthenticatedUser(chatId);

    if (user) {
      await bot.sendMessage(chatId, `مرحباً بعودتك ${user.fullNameAr}! 👋\nأنا مساعدك الذكي لنظام TaskFlow Pro.`);
      await sendMainMenu(bot, chatId);
    } else {
      awaitingUsername.add(chatId);
      await bot.sendMessage(
        chatId,
        '🔐 *مرحباً بك في TaskFlow Pro Bot*\n\nأنا مساعد إداري ذكي مخصص للمشرفين فقط.\nالرجاء إدخال اسم المستخدم (Username) للتحقق من صلاحياتك:',
        { parse_mode: 'Markdown' }
      );
    }
  });

  // ── Callback queries (button presses) ────────────────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message!.chat.id;
    const data = query.data || '';
    await bot.answerCallbackQuery(query.id);

    const user = await getAuthenticatedUser(chatId);
    if (!user) {
      await bot.sendMessage(chatId, '🔒 يجب تسجيل الدخول أولاً. أرسل /start');
      return;
    }

    // Main menu actions
    if (data === 'menu_stats') {
      const stats = await getSystemStats();
      await bot.sendMessage(chatId,
        `📊 *إحصائيات النظام الشاملة*\n\n` +
        `👥 إجمالي الموظفين: *${stats.totalUsers}*\n` +
        `✅ المهام المكتملة: *${stats.completedTasks}*\n` +
        `🔄 قيد التنفيذ: *${stats.inProgressTasks}*\n` +
        `⏳ قيد المراجعة: *${stats.reviewTasks}*\n` +
        `⚠️ المتأخرة: *${stats.overdueTasks}*\n` +
        `📋 إجمالي المهام: *${stats.totalTasks}*\n` +
        `📈 نسبة الإنجاز: *${stats.completionRate}%*\n` +
        `🏢 الأقسام: *${stats.totalDepts}*`,
        { parse_mode: 'Markdown' }
      );
      await sendMainMenu(bot, chatId);

    } else if (data === 'menu_overdue') {
      const overdue = await getOverdueTasks();
      if (overdue.length === 0) {
        await bot.sendMessage(chatId, '🎉 ممتاز! لا توجد أي مهام متأخرة حالياً في النظام.');
      } else {
        let msg = `⚠️ *المهام المتأخرة (${overdue.length})*\n\n`;
        overdue.slice(0, 15).forEach((t, i) => {
          const days = Math.floor((Date.now() - new Date(t.dueDate!).getTime()) / 86400000);
          msg += `${i + 1}. *${t.taskCode}* - ${t.titleAr || t.title}\n   👤 ${t.assignedTo.fullNameAr} | تأخر ${days} أيام\n\n`;
        });
        if (overdue.length > 15) msg += `_... و ${overdue.length - 15} مهمة أخرى_`;
        await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      }
      await sendMainMenu(bot, chatId);

    } else if (data === 'menu_employees') {
      const employees = await prisma.user.findMany({
        where: { isActive: true },
        include: { role: true, department: true },
        orderBy: { fullNameAr: 'asc' },
      });

      if (employees.length === 0) {
        await bot.sendMessage(chatId, 'لا يوجد موظفون نشطون في النظام.');
        await sendMainMenu(bot, chatId);
        return;
      }

      // Show list as inline buttons (max 20)
      const buttons = employees.slice(0, 20).map(emp => ([{
        text: `👤 ${emp.fullNameAr} (${emp.role.nameAr || emp.role.name})`,
        callback_data: `emp_${emp.id}`
      }]));
      buttons.push([{ text: '🔙 القائمة الرئيسية', callback_data: 'main_menu' }]);

      await bot.sendMessage(chatId, `👥 *قائمة الموظفين النشطين (${employees.length})*\nاختر موظفاً لعرض تفاصيله:`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });

    } else if (data.startsWith('emp_')) {
      const empId = parseInt(data.replace('emp_', ''));
      await showEmployeeDetails(bot, chatId, empId);

    } else if (data.startsWith('emp_tasks_')) {
      const empId = parseInt(data.replace('emp_tasks_', ''));
      await showEmployeeTasks(bot, chatId, empId);

    } else if (data.startsWith('emp_overdue_')) {
      const empId = parseInt(data.replace('emp_overdue_', ''));
      await showEmployeeOverdueTasks(bot, chatId, empId);

    } else if (data === 'menu_search_task') {
      sessionState.set(chatId, 'awaiting_task_code');
      await bot.sendMessage(chatId, '🔍 *البحث عن مهمة*\nأدخل كود المهمة (مثال: TASK-001):', { parse_mode: 'Markdown' });

    } else if (data === 'menu_departments') {
      const depts = await prisma.department.findMany({ include: { _count: { select: { users: true } } } });
      let msg = `🏢 *الأقسام (${depts.length})*\n\n`;
      depts.forEach(d => {
        msg += `• *${d.nameAr || d.name}*: ${d._count.users} موظف\n`;
      });
      await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      await sendMainMenu(bot, chatId);

    } else if (data === 'main_menu') {
      await sendMainMenu(bot, chatId);
    }
  });

  // ── Text messages ─────────────────────────────────────────
  bot.on('message', async (msg) => {
    if (msg.text?.startsWith('/')) return; // handled by onText
    const chatId = msg.chat.id;
    const text = msg.text?.trim() || '';

    const user = await getAuthenticatedUser(chatId);

    if (!user) {
      // Auth flow
      if (awaitingUsername.has(chatId)) {
        // Step 1: username
        const foundUser = await prisma.user.findFirst({
          where: { username: { equals: text, mode: 'insensitive' } },
          include: { role: true }
        });
        if (!foundUser || (!foundUser.role.name.toLowerCase().includes('super') && foundUser.role.level > 1)) {
          await bot.sendMessage(chatId, '❌ هذا الحساب غير موجود أو لا يملك صلاحيات المشرف العام.\nأعد المحاولة أو تواصل مع الدعم الفني.');
          return;
        }
        awaitingUsername.delete(chatId);
        pendingAuth.set(chatId, foundUser.username);
        await bot.sendMessage(chatId, `✅ تم العثور على الحساب: *${foundUser.fullNameAr}*\nالرجاء إدخال كلمة المرور:`, { parse_mode: 'Markdown' });
        return;
      }

      if (pendingAuth.has(chatId)) {
        // Step 2: password
        const username = pendingAuth.get(chatId)!;
        const foundUser = await prisma.user.findUnique({ where: { username } });
        if (!foundUser) return;

        const isMatch = await bcrypt.compare(text, foundUser.passwordHash);
        if (isMatch) {
          await prisma.user.update({ where: { id: foundUser.id }, data: { telegramChatId: String(chatId) } });
          pendingAuth.delete(chatId);
          await bot.sendMessage(chatId, `🎉 *تم تسجيل الدخول بنجاح!*\nمرحباً بك ${foundUser.fullNameAr}.`, { parse_mode: 'Markdown' });
          await sendMainMenu(bot, chatId);
        } else {
          pendingAuth.delete(chatId);
          awaitingUsername.add(chatId);
          await bot.sendMessage(chatId, '❌ كلمة المرور غير صحيحة. أعد إدخال اسم المستخدم:');
        }
        return;
      }

      // Not in any auth flow
      awaitingUsername.add(chatId);
      await bot.sendMessage(chatId, '🔒 يجب تسجيل الدخول أولاً.\nأرسل /start أو أدخل اسم المستخدم:');
      return;
    }

    // User is authenticated - handle state-based input first
    if (sessionState.get(chatId) === 'awaiting_task_code') {
      sessionState.delete(chatId);
      await showTaskByCode(bot, chatId, text);
      return;
    }

    // Handle text queries
    const lower = text.toLowerCase();
    if (lower.includes('بحث') || lower.includes('مهمة رقم') || lower.includes('task-')) {
      // Extract task code if mentioned directly
      const match = text.match(/[A-Za-z]+-\d+/i);
      if (match) {
        await showTaskByCode(bot, chatId, match[0]);
      } else {
        sessionState.set(chatId, 'awaiting_task_code');
        await bot.sendMessage(chatId, '🔍 أدخل كود المهمة (مثال: TASK-001):');
      }
    } else if (lower.includes('احصائيات') || lower.includes('إحصائيات') || lower.includes('stats')) {
      const stats = await getSystemStats();
      await bot.sendMessage(chatId, `📊 إجمالي المهام: ${stats.totalTasks} | المكتملة: ${stats.completedTasks} | المتأخرة: ${stats.overdueTasks} | نسبة الإنجاز: ${stats.completionRate}%`);
    } else if (lower.includes('موظف') || lower.includes('موظفين')) {
      const employees = await prisma.user.findMany({ where: { isActive: true }, include: { role: true, department: true }, orderBy: { fullNameAr: 'asc' } });
      const buttons = employees.slice(0, 20).map(emp => ([{ text: `👤 ${emp.fullNameAr} (${emp.role.nameAr || emp.role.name})`, callback_data: `emp_${emp.id}` }]));
      buttons.push([{ text: '🔙 القائمة الرئيسية', callback_data: 'main_menu' }]);
      await bot.sendMessage(chatId, `👥 *قائمة الموظفين النشطين (${employees.length})*\nاختر موظفاً:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
    } else if (lower.includes('متأخر') || lower.includes('تأخير')) {
      const overdue = await getOverdueTasks();
      if (overdue.length === 0) {
        await bot.sendMessage(chatId, '🎉 ممتاز! لا توجد مهام متأخرة حالياً.');
      } else {
        let msg = `⚠️ *المهام المتأخرة (${overdue.length})*\n\n`;
        overdue.slice(0, 10).forEach((t, i) => { const days = Math.floor((Date.now() - new Date(t.dueDate!).getTime()) / 86400000); msg += `${i+1}. *${t.taskCode}* - ${t.titleAr || t.title}\n   👤 ${t.assignedTo.fullNameAr} | تأخر ${days} أيام\n\n`; });
        await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      }
      await sendMainMenu(bot, chatId);
    } else {
      await sendMainMenu(bot, chatId, 'يمكنك استخدام القائمة أدناه أو اسألني مباشرة:');
    }
  });

  // ── /task command shortcut ─────────────────────────────
  bot.onText(/\/task (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const user = await getAuthenticatedUser(chatId);
    if (!user) { await bot.sendMessage(chatId, '🔒 سجل دخولك أولاً /start'); return; }
    await showTaskByCode(bot, chatId, match![1].trim());
  });

  } catch (err: any) {
    console.error('❌ Failed to initialize Telegram bot:', err.message || err);
    botInstance = null;
    // Retry after 10 seconds
    setTimeout(() => initTelegramBot(), 10000);
  }
}

// ── Helper: Send Main Menu ─────────────────────────────────
async function sendMainMenu(bot: TelegramBot, chatId: number, caption?: string) {
  await bot.sendMessage(chatId, caption || '📋 *القائمة الرئيسية* - اختر ما تريد:', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 إحصائيات النظام', callback_data: 'menu_stats' }],
        [{ text: '⚠️ المهام المتأخرة', callback_data: 'menu_overdue' }],
        [{ text: '👥 قائمة الموظفين', callback_data: 'menu_employees' }],
        [{ text: '🔍 بحث عن مهمة', callback_data: 'menu_search_task' }],
        [{ text: '🏢 الأقسام', callback_data: 'menu_departments' }],
      ]
    }
  });
}

// ── Helper: Show Task by Code ──────────────────────────────
async function showTaskByCode(bot: TelegramBot, chatId: number, code: string) {
  const task = await prisma.task.findFirst({
    where: { taskCode: { equals: code.trim(), mode: 'insensitive' } },
    include: {
      assignedTo: { include: { department: true } },
      createdBy: true,
      category: true,
    }
  });

  if (!task) {
    await bot.sendMessage(chatId,
      `❌ لم يتم العثور على مهمة بكود *${code}*\nتأكد من الكود وحاول مرة أخرى.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 بحث مرة أخرى', callback_data: 'menu_search_task' }],
            [{ text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }],
          ]
        }
      }
    );
    return;
  }

  const statusMap: Record<string, string> = {
    PENDING: '⏳ معلقة',
    IN_PROGRESS: '🔄 قيد التنفيذ',
    IN_REVIEW: '👀 قيد المراجعة',
    COMPLETED: '✅ مكتملة',
    CANCELLED: '❌ ملغاة',
  };

  const priorityMap: Record<string, string> = {
    LOW: '🟢 منخفضة',
    MEDIUM: '🟡 متوسطة',
    HIGH: '🔴 عالية',
    URGENT: '🚨 عاجلة',
  };

  const startDate = task.startDate ? new Date(task.startDate).toLocaleDateString('ar-EG') : 'غير محدد';
  const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-EG') : 'غير محدد';
  const isOverdue = task.dueDate && task.dueDate < new Date() && task.status !== 'COMPLETED';
  const daysDiff = task.dueDate ? Math.floor((Date.now() - new Date(task.dueDate).getTime()) / 86400000) : 0;

  let msg =
    `🗂️ *تفاصيل المهمة*\n\n` +
    `📌 الكود: *${task.taskCode}*\n` +
    `📝 العنوان: ${task.titleAr || task.title}\n` +
    `🏷️ الحالة: ${statusMap[task.status] || task.status}\n` +
    `⚡ الأولوية: ${priorityMap[task.priority] || task.priority}\n` +
    `📅 تاريخ البداية: *${startDate}*\n` +
    `⏰ تاريخ الانتهاء: *${dueDate}*\n`;

  if (isOverdue) msg += `🚨 متأخرة بـ *${daysDiff}* ${daysDiff === 1 ? 'يوم' : 'أيام'}!\n`;
  if (task.progressPercent !== undefined && task.progressPercent !== null) msg += `📈 نسبة الإنجاز: *${task.progressPercent}%*\n`;

  msg += `\n👤 *المسند إليه:*\n`;
  msg += `   الاسم: ${task.assignedTo.fullNameAr}\n`;
  msg += `   القسم: ${task.assignedTo.department?.nameAr || 'غير محدد'}\n`;

  if (task.createdBy) msg += `\n🖊️ أنشأها: ${task.createdBy.fullNameAr}\n`;
  if (task.category) msg += `📂 التصنيف: ${task.category.nameAr || task.category.name}\n`;
  if (task.description) {
    const desc = task.description || '';
    msg += `\n📄 الوصف:\n_${desc.slice(0, 200)}${desc.length > 200 ? '...' : ''}_`;
  }

  await bot.sendMessage(chatId, msg, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '👤 عرض ملف الموظف', callback_data: `emp_${task.assignedToId}` }],
        [{ text: '🔍 بحث عن مهمة أخرى', callback_data: 'menu_search_task' }],
        [{ text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }],
      ]
    }
  });
}

// ── Helper: Employee Details ───────────────────────────────
async function showEmployeeDetails(bot: TelegramBot, chatId: number, empId: number) {
  const emp = await prisma.user.findUnique({
    where: { id: empId },
    include: {
      role: true,
      department: true,
    }
  });
  if (!emp) return;

  const totalCount = await prisma.task.count({ where: { assignedToId: empId } });
  const completedCount = await prisma.task.count({ where: { assignedToId: empId, status: 'COMPLETED' } });
  const overdueCount = await prisma.task.count({
    where: { assignedToId: empId, dueDate: { lt: new Date() }, status: { not: 'COMPLETED' } }
  });

  const msg =
    `👤 *${emp.fullNameAr}*\n` +
    `🏷️ المنصب: ${emp.role.nameAr || emp.role.name}\n` +
    `🏢 القسم: ${emp.department?.nameAr || emp.department?.name || 'غير محدد'}\n` +
    `📋 إجمالي المهام: ${totalCount}\n` +
    `✅ المكتملة: ${completedCount}\n` +
    `⚠️ المتأخرة: ${overdueCount}\n` +
    `📧 البريد: ${emp.email || 'غير محدد'}`;

  await bot.sendMessage(chatId, msg, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 كل مهامه', callback_data: `emp_tasks_${empId}` }],
        [{ text: '⚠️ مهامه المتأخرة', callback_data: `emp_overdue_${empId}` }],
        [{ text: '🔙 قائمة الموظفين', callback_data: 'menu_employees' }],
        [{ text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }],
      ]
    }
  });
}

// ── Helper: Employee Tasks ─────────────────────────────────
async function showEmployeeTasks(bot: TelegramBot, chatId: number, empId: number) {
  const emp = await prisma.user.findUnique({ where: { id: empId } });
  const tasks = await prisma.task.findMany({
    where: { assignedToId: empId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (tasks.length === 0) {
    await bot.sendMessage(chatId, `لا توجد مهام مسندة لـ *${emp?.fullNameAr}*`, { parse_mode: 'Markdown' });
    await showEmployeeDetails(bot, chatId, empId);
    return;
  }

  const statusEmoji: Record<string, string> = {
    PENDING: '⏳', IN_PROGRESS: '🔄', IN_REVIEW: '👀', COMPLETED: '✅', CANCELLED: '❌'
  };

  let msg = `📋 *مهام ${emp?.fullNameAr} (آخر ${tasks.length})*\n\n`;
  tasks.forEach((t, i) => {
    const emoji = statusEmoji[t.status] || '📌';
    msg += `${i + 1}. ${emoji} *${t.taskCode}* - ${t.titleAr || t.title}\n`;
  });

  await bot.sendMessage(chatId, msg, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⚠️ المتأخرة فقط', callback_data: `emp_overdue_${empId}` }],
        [{ text: '🔙 رجوع للموظف', callback_data: `emp_${empId}` }],
        [{ text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }],
      ]
    }
  });
}

// ── Helper: Employee Overdue Tasks ─────────────────────────
async function showEmployeeOverdueTasks(bot: TelegramBot, chatId: number, empId: number) {
  const emp = await prisma.user.findUnique({ where: { id: empId } });
  const tasks = await prisma.task.findMany({
    where: { assignedToId: empId, dueDate: { lt: new Date() }, status: { not: 'COMPLETED' } },
    orderBy: { dueDate: 'asc' },
  });

  if (tasks.length === 0) {
    await bot.sendMessage(chatId, `🎉 ممتاز! لا توجد مهام متأخرة للموظف *${emp?.fullNameAr}*`, { parse_mode: 'Markdown' });
  } else {
    let msg = `⚠️ *المهام المتأخرة لـ ${emp?.fullNameAr} (${tasks.length})*\n\n`;
    tasks.forEach((t, i) => {
      const days = Math.floor((Date.now() - new Date(t.dueDate!).getTime()) / 86400000);
      msg += `${i + 1}. *${t.taskCode}* - ${t.titleAr || t.title}\n   تأخر *${days}* ${days === 1 ? 'يوم' : 'أيام'}\n\n`;
    });
    await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
  }

  await bot.sendMessage(chatId, 'اختر:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 رجوع للموظف', callback_data: `emp_${empId}` }],
        [{ text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }],
      ]
    }
  });
}

// ── Helper: Get authenticated user ────────────────────────
async function getAuthenticatedUser(chatId: number) {
  return prisma.user.findUnique({
    where: { telegramChatId: String(chatId) },
    include: { role: true }
  });
}

// ── Helper: System stats ───────────────────────────────────
async function getSystemStats() {
  const today = new Date();
  const [totalTasks, completedTasks, inProgressTasks, reviewTasks, overdueTasks, totalUsers, totalDepts] = await Promise.all([
    prisma.task.count(),
    prisma.task.count({ where: { status: 'COMPLETED' } }),
    prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { status: 'IN_REVIEW' } }),
    prisma.task.count({ where: { dueDate: { lt: today }, status: { not: 'COMPLETED' } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.department.count(),
  ]);
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  return { totalTasks, completedTasks, inProgressTasks, reviewTasks, overdueTasks, totalUsers, totalDepts, completionRate };
}

// ── Helper: All overdue tasks ──────────────────────────────
async function getOverdueTasks() {
  return prisma.task.findMany({
    where: { dueDate: { lt: new Date() }, status: { not: 'COMPLETED' } },
    include: { assignedTo: true },
    orderBy: { dueDate: 'asc' },
  });
}
