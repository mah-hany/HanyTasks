import TelegramBot from 'node-telegram-bot-api';
import prisma from '../../prisma/client';
import bcrypt from 'bcryptjs';
import https from 'https';

const pendingAuth = new Map<number, string>();
const awaitingUsername = new Set<number>();
const sessionState = new Map<number, string>();
let botInstance: TelegramBot | null = null;

function deleteWebhookRaw(token: string): Promise<void> {
  return new Promise((resolve) => {
    const url = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => { console.log('Webhook deleted:', data); resolve(); });
    }).on('error', (e) => { console.warn('deleteWebhook error:', e.message); resolve(); });
  });
}

function isAdmin(user: any) { return user?.role?.level <= 2; }

export async function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN || '7808940555:AAFvtJAdJFaaqV47_htRkRvdb97ub0duC_c';
  if (!token) { console.warn('No TELEGRAM_BOT_TOKEN'); return; }
  if (botInstance) { console.log('Bot already running.'); return; }

  try {
    await deleteWebhookRaw(token);
    const bot = new TelegramBot(token, {
      polling: { interval: 1000, autoStart: true, params: { timeout: 10, allowed_updates: ['message', 'callback_query'] } }
    });
    botInstance = bot;
    console.log('✅ Telegram Bot polling started.');

    bot.on('polling_error', (err: any) => {
      const msg = err.message || String(err);
      if (msg.includes('409')) {
        bot.stopPolling().then(() => { botInstance = null; setTimeout(() => initTelegramBot(), 5000); });
      } else console.error('Polling error:', msg);
    });

    // /start
    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const user = await getUser(chatId);
      if (user) {
        await bot.sendMessage(chatId, `👋 مرحباً بعودتك *${user.fullNameAr}*!`, { parse_mode: 'Markdown' });
        await sendMenu(bot, chatId, user);
      } else {
        awaitingUsername.add(chatId);
        await bot.sendMessage(chatId,
          '🔐 *مرحباً في TaskFlow Pro Bot*\n\nيمكن لجميع الموظفين استخدام البوت.\nأدخل اسم المستخدم (Username):',
          { parse_mode: 'Markdown' });
      }
    });

    // /logout
    bot.onText(/\/logout/, async (msg) => {
      const chatId = msg.chat.id;
      await prisma.user.updateMany({ where: { telegramChatId: String(chatId) }, data: { telegramChatId: null } });
      awaitingUsername.add(chatId);
      await bot.sendMessage(chatId, '👋 تم تسجيل الخروج. أرسل /start للدخول مجدداً.');
    });

    // Callback queries
    bot.on('callback_query', async (query) => {
      const chatId = query.message!.chat.id;
      const data = query.data || '';
      await bot.answerCallbackQuery(query.id);
      const user = await getUser(chatId);
      if (!user) { await bot.sendMessage(chatId, '🔒 أرسل /start لتسجيل الدخول'); return; }

      // ─── ADMIN callbacks ───
      if (data === 'admin_stats') {
        const s = await getSystemStats();
        await bot.sendMessage(chatId,
          `📊 *إحصائيات النظام*\n\n` +
          `📋 إجمالي المهام: *${s.totalTasks}*\n` +
          `✅ مكتملة: *${s.completedTasks}*\n` +
          `🔄 قيد التنفيذ: *${s.inProgressTasks}*\n` +
          `⚠️ متأخرة: *${s.overdueTasks}*\n` +
          `📈 نسبة الإنجاز: *${s.completionRate}%*\n` +
          `👥 الموظفون النشطون: *${s.totalUsers}*\n` +
          `🏢 الأقسام: *${s.totalDepts}*`,
          { parse_mode: 'Markdown' });
        await sendMenu(bot, chatId, user);

      } else if (data === 'admin_overdue') {
        const tasks = await getOverdueTasks();
        if (!tasks.length) { await bot.sendMessage(chatId, '🎉 لا توجد مهام متأخرة!'); }
        else {
          let m = `⚠️ *المهام المتأخرة (${tasks.length})*\n\n`;
          tasks.slice(0, 15).forEach((t, i) => {
            const d = Math.floor((Date.now() - new Date(t.dueDate!).getTime()) / 86400000);
            m += `${i+1}. *${t.taskCode}* - ${t.titleAr || t.title}\n   👤 ${t.assignedTo.fullNameAr} | تأخر *${d}* يوم\n\n`;
          });
          await bot.sendMessage(chatId, m, { parse_mode: 'Markdown' });
        }
        await sendMenu(bot, chatId, user);

      } else if (data === 'admin_employees') {
        const emps = await prisma.user.findMany({ where: { isActive: true }, include: { role: true }, orderBy: { fullNameAr: 'asc' } });
        const btns = emps.slice(0, 20).map(e => ([{ text: `👤 ${e.fullNameAr} (${e.role.nameAr || e.role.name})`, callback_data: `emp_${e.id}` }]));
        btns.push([{ text: '🏠 القائمة', callback_data: 'main_menu' }]);
        await bot.sendMessage(chatId, `👥 *الموظفون النشطون (${emps.length})*\nاختر موظفاً:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });

      } else if (data === 'admin_search') {
        sessionState.set(chatId, 'awaiting_task_code');
        await bot.sendMessage(chatId, '🔍 أدخل كود المهمة (مثال: TSK-2026-001):');

      } else if (data === 'admin_depts') {
        const depts = await prisma.department.findMany({ include: { _count: { select: { users: true } } } });
        let m = `🏢 *الأقسام (${depts.length})*\n\n`;
        depts.forEach(d => { m += `• *${d.nameAr || d.name}*: ${d._count.users} موظف\n`; });
        await bot.sendMessage(chatId, m, { parse_mode: 'Markdown' });
        await sendMenu(bot, chatId, user);

      } else if (data.startsWith('emp_') && !data.startsWith('emp_tasks_') && !data.startsWith('emp_overdue_')) {
        await showEmpDetails(bot, chatId, parseInt(data.replace('emp_', '')));

      } else if (data.startsWith('emp_tasks_')) {
        await showEmpTasks(bot, chatId, parseInt(data.replace('emp_tasks_', '')));

      } else if (data.startsWith('emp_overdue_')) {
        await showEmpOverdue(bot, chatId, parseInt(data.replace('emp_overdue_', '')));

      // ─── EMPLOYEE callbacks ───
      } else if (data === 'my_tasks') {
        await showMyTasks(bot, chatId, user.id);

      } else if (data === 'my_overdue') {
        await showMyOverdue(bot, chatId, user.id);

      } else if (data === 'my_stats') {
        await showMyStats(bot, chatId, user);

      } else if (data === 'my_search') {
        sessionState.set(chatId, 'awaiting_task_code');
        await bot.sendMessage(chatId, '🔍 أدخل كود المهمة:');

      } else if (data === 'main_menu') {
        await sendMenu(bot, chatId, user);
      }
    });

    // Text messages
    bot.on('message', async (msg) => {
      if (msg.text?.startsWith('/')) return;
      const chatId = msg.chat.id;
      const text = msg.text?.trim() || '';
      const user = await getUser(chatId);

      if (!user) {
        if (awaitingUsername.has(chatId)) {
          const found = await prisma.user.findFirst({ where: { username: { equals: text, mode: 'insensitive' } }, include: { role: true } });
          if (!found || !found.isActive) {
            await bot.sendMessage(chatId, '❌ اسم المستخدم غير موجود أو الحساب غير نشط. حاول مرة أخرى:');
            return;
          }
          awaitingUsername.delete(chatId);
          pendingAuth.set(chatId, found.username);
          await bot.sendMessage(chatId, `✅ تم العثور على: *${found.fullNameAr}*\nأدخل كلمة المرور:`, { parse_mode: 'Markdown' });
          return;
        }
        if (pendingAuth.has(chatId)) {
          const username = pendingAuth.get(chatId)!;
          const found = await prisma.user.findUnique({ where: { username }, include: { role: true } });
          if (!found) return;
          const ok = await bcrypt.compare(text, found.passwordHash);
          if (ok) {
            await prisma.user.update({ where: { id: found.id }, data: { telegramChatId: String(chatId) } });
            pendingAuth.delete(chatId);
            await bot.sendMessage(chatId, `🎉 *أهلاً ${found.fullNameAr}!*\nتم تسجيل الدخول بنجاح.`, { parse_mode: 'Markdown' });
            await sendMenu(bot, chatId, found);
          } else {
            pendingAuth.delete(chatId);
            awaitingUsername.add(chatId);
            await bot.sendMessage(chatId, '❌ كلمة المرور خاطئة. أعد إدخال اسم المستخدم:');
          }
          return;
        }
        awaitingUsername.add(chatId);
        await bot.sendMessage(chatId, '🔒 أرسل /start لتسجيل الدخول.');
        return;
      }

      // Authenticated - check state
      if (sessionState.get(chatId) === 'awaiting_task_code') {
        sessionState.delete(chatId);
        await showTaskByCode(bot, chatId, text, user);
        return;
      }

      await sendMenu(bot, chatId, user, 'استخدم القائمة:');
    });

  } catch (err: any) {
    console.error('❌ Bot init failed:', err.message);
    botInstance = null;
    setTimeout(() => initTelegramBot(), 10000);
  }
}

// ── Send role-based menu ──────────────────────────────────────
async function sendMenu(bot: TelegramBot, chatId: number, user: any, caption?: string) {
  const name = user.fullNameAr || user.fullName || '';
  const roleLabel = user.role?.nameAr || user.role?.name || '';

  if (isAdmin(user)) {
    await bot.sendMessage(chatId, caption || `📋 *القائمة الرئيسية* — ${name} | ${roleLabel}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 إحصائيات النظام', callback_data: 'admin_stats' }],
          [{ text: '⚠️ المهام المتأخرة', callback_data: 'admin_overdue' }],
          [{ text: '👥 قائمة الموظفين', callback_data: 'admin_employees' }],
          [{ text: '🔍 بحث عن مهمة', callback_data: 'admin_search' }],
          [{ text: '🏢 الأقسام', callback_data: 'admin_depts' }],
        ]
      }
    });
  } else {
    await bot.sendMessage(chatId, caption || `📋 *قائمتي* — ${name} | ${roleLabel}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 إحصائياتي', callback_data: 'my_stats' }],
          [{ text: '📋 مهامي', callback_data: 'my_tasks' }],
          [{ text: '⚠️ مهامي المتأخرة', callback_data: 'my_overdue' }],
          [{ text: '🔍 بحث عن مهمة', callback_data: 'my_search' }],
        ]
      }
    });
  }
}

// ── Employee: my stats ────────────────────────────────────────
async function showMyStats(bot: TelegramBot, chatId: number, user: any) {
  const [total, completed, inProgress, overdue, underReview] = await Promise.all([
    prisma.task.count({ where: { assignedToId: user.id } }),
    prisma.task.count({ where: { assignedToId: user.id, status: 'COMPLETED' } }),
    prisma.task.count({ where: { assignedToId: user.id, status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { assignedToId: user.id, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.task.count({ where: { assignedToId: user.id, status: 'UNDER_REVIEW' } }),
  ]);
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  await bot.sendMessage(chatId,
    `📊 *إحصائياتي — ${user.fullNameAr}*\n\n` +
    `📋 إجمالي مهامي: *${total}*\n` +
    `✅ مكتملة: *${completed}*\n` +
    `🔄 قيد التنفيذ: *${inProgress}*\n` +
    `👀 تحت المراجعة: *${underReview}*\n` +
    `⚠️ متأخرة: *${overdue}*\n` +
    `📈 نسبة إنجازي: *${rate}%*`,
    { parse_mode: 'Markdown' });
  await sendMenu(bot, chatId, user);
}

// ── Employee: my tasks ────────────────────────────────────────
async function showMyTasks(bot: TelegramBot, chatId: number, userId: number) {
  const user = await getUser(chatId);
  const tasks = await prisma.task.findMany({
    where: { assignedToId: userId },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  if (!tasks.length) {
    await bot.sendMessage(chatId, '📭 لا توجد مهام مسندة إليك حالياً.');
    await sendMenu(bot, chatId, user);
    return;
  }

  const statusEmoji: Record<string, string> = {
    NEW: '🆕', IN_PROGRESS: '🔄', UNDER_REVIEW: '👀',
    REVISION_REQUIRED: '✏️', COMPLETED: '✅', CANCELLED: '❌'
  };

  let m = `📋 *مهامي (آخر ${tasks.length})*\n\n`;
  tasks.forEach((t, i) => {
    const e = statusEmoji[t.status] || '📌';
    const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString('ar-EG') : '';
    m += `${i+1}. ${e} *${t.taskCode}*\n   ${t.titleAr || t.title}\n   ${due ? `📅 ${due}` : ''}\n\n`;
  });

  await bot.sendMessage(chatId, m, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⚠️ المتأخرة فقط', callback_data: 'my_overdue' }],
        [{ text: '🏠 القائمة', callback_data: 'main_menu' }],
      ]
    }
  });
}

// ── Employee: my overdue ──────────────────────────────────────
async function showMyOverdue(bot: TelegramBot, chatId: number, userId: number) {
  const user = await getUser(chatId);
  const tasks = await prisma.task.findMany({
    where: { assignedToId: userId, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    orderBy: { dueDate: 'asc' },
  });

  if (!tasks.length) {
    await bot.sendMessage(chatId, '🎉 رائع! لا توجد مهام متأخرة عليك.');
  } else {
    let m = `⚠️ *مهامي المتأخرة (${tasks.length})*\n\n`;
    tasks.forEach((t, i) => {
      const d = Math.floor((Date.now() - new Date(t.dueDate!).getTime()) / 86400000);
      m += `${i+1}. *${t.taskCode}* - ${t.titleAr || t.title}\n   تأخرت *${d}* ${d === 1 ? 'يوم' : 'أيام'} ‼️\n\n`;
    });
    await bot.sendMessage(chatId, m, { parse_mode: 'Markdown' });
  }
  await sendMenu(bot, chatId, user);
}

// ── Show task by code (role-aware) ────────────────────────────
async function showTaskByCode(bot: TelegramBot, chatId: number, code: string, currentUser: any) {
  const task = await prisma.task.findFirst({
    where: { taskCode: { equals: code.trim(), mode: 'insensitive' } },
    include: { assignedTo: { include: { department: true } }, createdBy: true },
  });

  if (!task) {
    await bot.sendMessage(chatId, `❌ لم أجد مهمة بكود *${code}*`, { parse_mode: 'Markdown' });
    await sendMenu(bot, chatId, currentUser);
    return;
  }

  // Non-admin can only see their own tasks
  if (!isAdmin(currentUser) && task.assignedToId !== currentUser.id) {
    await bot.sendMessage(chatId, '🔒 هذه المهمة ليست مسندة إليك.');
    await sendMenu(bot, chatId, currentUser);
    return;
  }

  const statusMap: Record<string, string> = {
    NEW: '🆕 جديدة', IN_PROGRESS: '🔄 قيد التنفيذ', UNDER_REVIEW: '👀 تحت المراجعة',
    REVISION_REQUIRED: '✏️ تحتاج تعديل', COMPLETED: '✅ مكتملة', CANCELLED: '❌ ملغاة',
  };
  const priorityMap: Record<string, string> = { LOW: '🟢 منخفضة', MEDIUM: '🟡 متوسطة', HIGH: '🔴 عالية', URGENT: '🚨 عاجلة' };

  const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-EG') : 'غير محدد';
  const isOverdue = task.dueDate && task.dueDate < new Date() && task.status !== 'COMPLETED';
  const days = task.dueDate ? Math.floor((Date.now() - new Date(task.dueDate).getTime()) / 86400000) : 0;

  let m =
    `🗂️ *${task.taskCode}*\n` +
    `📝 ${task.titleAr || task.title}\n\n` +
    `🏷️ الحالة: ${statusMap[task.status] || task.status}\n` +
    `⚡ الأولوية: ${priorityMap[task.priority] || task.priority}\n` +
    `⏰ الاستحقاق: *${due}*\n` +
    `📈 الإنجاز: *${task.progressPercent ?? 0}%*\n`;
  if (isOverdue) m += `🚨 متأخرة *${days}* ${days === 1 ? 'يوم' : 'أيام'}!\n`;
  m += `\n👤 ${task.assignedTo.fullNameAr} — ${task.assignedTo.department?.nameAr || ''}`;

  await bot.sendMessage(chatId, m, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '🏠 القائمة', callback_data: 'main_menu' }]] }
  });
}

// ── Admin: employee details ───────────────────────────────────
async function showEmpDetails(bot: TelegramBot, chatId: number, empId: number) {
  const emp = await prisma.user.findUnique({ where: { id: empId }, include: { role: true, department: true } });
  if (!emp) return;
  const [total, done, late] = await Promise.all([
    prisma.task.count({ where: { assignedToId: empId } }),
    prisma.task.count({ where: { assignedToId: empId, status: 'COMPLETED' } }),
    prisma.task.count({ where: { assignedToId: empId, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
  ]);
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  await bot.sendMessage(chatId,
    `👤 *${emp.fullNameAr}*\n` +
    `🏷️ ${emp.role.nameAr || emp.role.name}\n` +
    `🏢 ${emp.department?.nameAr || 'بدون قسم'}\n` +
    `📋 مهام: *${total}* | ✅ *${done}* | ⚠️ *${late}*\n` +
    `📈 الإنجاز: *${rate}%*\n` +
    `📧 ${emp.email || '—'}`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
      [{ text: '📋 كل مهامه', callback_data: `emp_tasks_${empId}` }, { text: '⚠️ المتأخرة', callback_data: `emp_overdue_${empId}` }],
      [{ text: '🔙 الموظفون', callback_data: 'admin_employees' }, { text: '🏠 القائمة', callback_data: 'main_menu' }],
    ]}}
  );
}

async function showEmpTasks(bot: TelegramBot, chatId: number, empId: number) {
  const emp = await prisma.user.findUnique({ where: { id: empId } });
  const tasks = await prisma.task.findMany({ where: { assignedToId: empId }, orderBy: { createdAt: 'desc' }, take: 10 });
  if (!tasks.length) { await bot.sendMessage(chatId, `لا توجد مهام لـ *${emp?.fullNameAr}*`, { parse_mode: 'Markdown' }); return; }
  const e: Record<string, string> = { NEW: '🆕', IN_PROGRESS: '🔄', UNDER_REVIEW: '👀', COMPLETED: '✅', CANCELLED: '❌', REVISION_REQUIRED: '✏️' };
  let m = `📋 *مهام ${emp?.fullNameAr}*\n\n`;
  tasks.forEach((t, i) => { m += `${i+1}. ${e[t.status]||'📌'} *${t.taskCode}* - ${t.titleAr || t.title}\n`; });
  await bot.sendMessage(chatId, m, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: `emp_${empId}` }]] } });
}

async function showEmpOverdue(bot: TelegramBot, chatId: number, empId: number) {
  const emp = await prisma.user.findUnique({ where: { id: empId } });
  const tasks = await prisma.task.findMany({ where: { assignedToId: empId, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, orderBy: { dueDate: 'asc' } });
  if (!tasks.length) { await bot.sendMessage(chatId, `🎉 لا توجد مهام متأخرة لـ *${emp?.fullNameAr}*`, { parse_mode: 'Markdown' }); }
  else {
    let m = `⚠️ *متأخرات ${emp?.fullNameAr} (${tasks.length})*\n\n`;
    tasks.forEach((t, i) => { const d = Math.floor((Date.now() - new Date(t.dueDate!).getTime()) / 86400000); m += `${i+1}. *${t.taskCode}* - ${t.titleAr || t.title}\n   تأخر *${d}* يوم\n\n`; });
    await bot.sendMessage(chatId, m, { parse_mode: 'Markdown' });
  }
  await bot.sendMessage(chatId, '↩️', { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: `emp_${empId}` }, { text: '🏠 القائمة', callback_data: 'main_menu' }]] } });
}

// ── Helpers ───────────────────────────────────────────────────
async function getUser(chatId: number) {
  return prisma.user.findUnique({ where: { telegramChatId: String(chatId) }, include: { role: true } });
}

async function getSystemStats() {
  const now = new Date();
  const [totalTasks, completedTasks, inProgressTasks, overdueTasks, totalUsers, totalDepts] = await Promise.all([
    prisma.task.count(),
    prisma.task.count({ where: { status: 'COMPLETED' } }),
    prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { dueDate: { lt: now }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.department.count(),
  ]);
  return { totalTasks, completedTasks, inProgressTasks, overdueTasks, totalUsers, totalDepts, completionRate: totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0 };
}

async function getOverdueTasks() {
  return prisma.task.findMany({ where: { dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, include: { assignedTo: true }, orderBy: { dueDate: 'asc' } });
}
