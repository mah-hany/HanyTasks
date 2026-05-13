import TelegramBot from 'node-telegram-bot-api';
import prisma from '../../prisma/client';
import bcrypt from 'bcryptjs';
import https from 'https';
import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const pendingAuth  = new Map<number, string>();
const awaitingUsername = new Set<number>();
const sessionState = new Map<number, string>();
const sessionData  = new Map<number, any>(); // multi-step form data

let bot: TelegramBot | null = null;

function isAdmin(user: any) { return user?.role?.level <= 2; }

/** Called from app.ts to register the webhook route */
export function getTelegramBot(): TelegramBot | null { return bot; }

/** Send a message to a specific user */
export async function sendTelegramNotification(userId: number, text: string) {
  if (!bot) return;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.telegramChatId) {
    try {
      await bot.sendMessage(user.telegramChatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      console.warn(`Failed to send telegram message to user ${userId}`);
    }
  }
}

/** Set Telegram webhook via raw HTTPS */
function setWebhook(token: string, webhookUrl: string): Promise<void> {
  return new Promise((resolve) => {
    const url = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true&allowed_updates=["message","callback_query"]`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => { console.log('Webhook set:', data); resolve(); });
    }).on('error', (e) => { console.warn('setWebhook error:', e.message); resolve(); });
  });
}

/** Delete webhook (for local dev polling mode) */
function deleteWebhook(token: string): Promise<void> {
  return new Promise((resolve) => {
    const url = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => { console.log('Webhook deleted:', data); resolve(); });
    }).on('error', (e) => { console.warn('deleteWebhook error:', e.message); resolve(); });
  });
}

export async function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { console.warn('⚠️  TELEGRAM_BOT_TOKEN not set — bot disabled'); return; }

  const isProduction = process.env.NODE_ENV === 'production';
  const appUrl = process.env.APP_URL || 'https://hanytasks.onrender.com';

  if (isProduction) {
    // ── PRODUCTION: use Webhook ──────────────────────────────
    bot = new TelegramBot(token); // no polling
    const webhookUrl = `${appUrl}/api/telegram/webhook`;
    await setWebhook(token, webhookUrl);
    console.log(`✅ Telegram Bot webhook set: ${webhookUrl}`);
  } else {
    // ── LOCAL DEV: use Polling ───────────────────────────────
    await deleteWebhook(token);
    bot = new TelegramBot(token, {
      polling: { interval: 1000, autoStart: true, params: { timeout: 10, allowed_updates: ['message', 'callback_query'] } }
    });
    bot.on('polling_error', (err: any) => console.error('Polling error:', err.message));
    console.log('✅ Telegram Bot polling started (dev mode).');
  }

  registerHandlers(bot);
  registerStatusHandler(bot);
}

/** Express route handler — called from app.ts for POST /api/telegram/webhook */
export function handleTelegramWebhook(req: Request, res: Response) {
  res.sendStatus(200); // always respond immediately
  if (bot) bot.processUpdate(req.body);
}

// ── Register all bot handlers ─────────────────────────────────
function registerHandlers(b: TelegramBot) {

  // /start
  b.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await getUser(chatId);
    if (user) {
      await b.sendMessage(chatId, `👋 مرحباً بعودتك *${user.fullNameAr}*!`, { parse_mode: 'Markdown' });
      await sendMenu(b, chatId, user);
    } else {
      awaitingUsername.add(chatId);
      await b.sendMessage(chatId,
        '🔐 *مرحباً في TaskFlow Pro Bot*\n\nيمكن لجميع الموظفين استخدام البوت.\nأدخل اسم المستخدم (Username):',
        { parse_mode: 'Markdown' });
    }
  });

  // /logout
  b.onText(/\/logout/, async (msg) => {
    const chatId = msg.chat.id;
    await prisma.user.updateMany({ where: { telegramChatId: String(chatId) }, data: { telegramChatId: null } });
    pendingAuth.delete(chatId);
    awaitingUsername.delete(chatId);
    sessionState.delete(chatId);
    awaitingUsername.add(chatId);
    await b.sendMessage(chatId, '👋 تم تسجيل الخروج. أرسل /start للدخول مجدداً.');
  });

  // /report
  b.onText(/\/report/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await getUser(chatId);
    if (!user) { await b.sendMessage(chatId, '🔒 أرسل /start لتسجيل الدخول'); return; }
    if (!isAdmin(user)) { await b.sendMessage(chatId, '🔒 صلاحية المديرين فقط.'); return; }
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [created, completed, overdue] = await Promise.all([
      prisma.task.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.task.count({ where: { status: 'COMPLETED', completedDate: { gte: today, lt: tomorrow } } }),
      prisma.task.count({ where: { dueDate: { lt: today }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } })
    ]);

    await b.sendMessage(chatId, 
      `📈 *التقرير اليومي للمدير*\n\n` +
      `🆕 مهام أُضيفت اليوم: *${created}*\n` +
      `✅ مهام أُنجزت اليوم: *${completed}*\n` +
      `⚠️ مهام متأخرة بالمجمل: *${overdue}*`, 
      { parse_mode: 'Markdown' });
  });

  // /today_tasks
  b.onText(/\/today_tasks/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await getUser(chatId);
    if (!user) return;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const tasks = await prisma.task.findMany({
      where: { assignedToId: user.id, dueDate: { gte: today, lt: tomorrow }, status: { notIn: ['COMPLETED', 'CANCELLED'] } }
    });

    if (!tasks.length) {
      await b.sendMessage(chatId, '🎉 ليس لديك مهام مطلوب تسليمها اليوم!');
      return;
    }
    let m = `📅 *مهامك المطلوبة اليوم (${tasks.length})*\n\n`;
    tasks.forEach(t => { m += `• *${t.taskCode}*: ${t.titleAr || t.title}\n`; });
    await b.sendMessage(chatId, m, { parse_mode: 'Markdown' });
  });

  // /employee
  b.onText(/\/employee/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await getUser(chatId);
    if (!user) return;
    if (!isAdmin(user)) { await b.sendMessage(chatId, '🔒 صلاحية المديرين فقط.'); return; }
    
    sessionState.set(chatId, 'search_employee');
    await b.sendMessage(chatId, '🔍 أدخل اسم الموظف أو كوده (Employee Code) للبحث عنه:');
  });

  // /status
  b.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    if (!(await getUser(chatId))) return;
    sessionState.set(chatId, 'us_code');
    await b.sendMessage(chatId, '🔄 أدخل كود المهمة لتغيير حالتها:');
  });

  // /ask (AI Assistant)
  b.onText(/\/ask(?:\s+(.*))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const user = await getUser(chatId);
    if (!user) { await b.sendMessage(chatId, '🔒 أرسل /start لتسجيل الدخول'); return; }
    
    const query = match?.[1]?.trim();
    if (!query) {
      await b.sendMessage(chatId, '🤖 *المساعد الذكي (AI)*\nأرسل سؤالك بعد الأمر، مثال:\n`/ask كيف أكتب تقريراً جيداً؟`', { parse_mode: 'Markdown' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await b.sendMessage(chatId, '❌ خدمة المساعد الذكي غير مفعلة حالياً (يجب أن يقوم مدير النظام بإضافة مفتاح GEMINI_API_KEY).');
      return;
    }

    try {
      const waitMsg = await b.sendMessage(chatId, '⏳ جاري التفكير...', { parse_mode: 'Markdown' });
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `أنت مساعد ذكي احترافي مدمج في نظام إدارة المهام الخاص بنا (Hany Tasks).
الموظف الذي يطرح عليك السؤال اسمه "${user.fullNameAr}" (دوره: ${user.role?.nameAr || 'موظف'}).
أجب على سؤاله التالي بشكل مختصر، مفيد، ومحفز للعمل:
السؤال: ${query}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Delete the 'thinking' message and send the actual response
      await b.deleteMessage(chatId, waitMsg.message_id).catch(() => {});
      await b.sendMessage(chatId, `🤖 *المساعد الذكي*\n\n${responseText}`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('AI Error:', err);
      await b.sendMessage(chatId, '❌ عذراً، حدث خطأ أثناء التفكير. قد يكون هناك ضغط على الخدمة.');
    }
  });

  // Callback queries
  b.on('callback_query', async (query) => {
    const chatId = query.message!.chat.id;
    const data = query.data || '';
    await b.answerCallbackQuery(query.id);
    const user = await getUser(chatId);
    if (!user) { await b.sendMessage(chatId, '🔒 أرسل /start لتسجيل الدخول'); return; }

    if (data === 'admin_stats') {
      const s = await getSystemStats();
      await b.sendMessage(chatId,
        `📊 *إحصائيات النظام*\n\n` +
        `📋 إجمالي المهام: *${s.totalTasks}*\n✅ مكتملة: *${s.completedTasks}*\n` +
        `🔄 قيد التنفيذ: *${s.inProgressTasks}*\n⚠️ متأخرة: *${s.overdueTasks}*\n` +
        `📈 نسبة الإنجاز: *${s.completionRate}%*\n👥 الموظفون: *${s.totalUsers}*\n🏢 الأقسام: *${s.totalDepts}*`,
        { parse_mode: 'Markdown' });
      await sendMenu(b, chatId, user);

    } else if (data === 'admin_overdue') {
      const tasks = await getOverdueTasks();
      if (!tasks.length) { await b.sendMessage(chatId, '🎉 لا توجد مهام متأخرة!'); }
      else {
        let m = `⚠️ *المهام المتأخرة (${tasks.length})*\n\n`;
        tasks.slice(0, 15).forEach((t, i) => {
          const d = Math.floor((Date.now() - new Date(t.dueDate!).getTime()) / 86400000);
          m += `${i+1}. *${t.taskCode}* - ${t.titleAr || t.title}\n   👤 ${t.assignedTo.fullNameAr} | تأخر *${d}* يوم\n\n`;
        });
        await b.sendMessage(chatId, m, { parse_mode: 'Markdown' });
      }
      await sendMenu(b, chatId, user);

    } else if (data === 'admin_employees') {
      const emps = await prisma.user.findMany({ where: { isActive: true }, include: { role: true }, orderBy: { fullNameAr: 'asc' } });
      const btns = emps.slice(0, 20).map(e => ([{ text: `👤 ${e.fullNameAr} (${e.role.nameAr || e.role.name})`, callback_data: `emp_${e.id}` }]));
      btns.push([{ text: '🏠 القائمة', callback_data: 'main_menu' }]);
      await b.sendMessage(chatId, `👥 *الموظفون النشطون (${emps.length})*\nاختر موظفاً:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });

    } else if (data === 'admin_search' || data === 'my_search') {
      sessionState.set(chatId, 'awaiting_task_code');
      await b.sendMessage(chatId, '🔍 أدخل كود المهمة (مثال: TSK-2026-001):');

    } else if (data === 'create_task') {
      if (!isAdmin(user)) { await b.sendMessage(chatId, '🔒 صلاحية المديرين فقط.'); return; }
      sessionState.set(chatId, 'ct_title');
      sessionData.set(chatId, {});
      await b.sendMessage(chatId, '📝 *إنشاء مهمة جديدة*\n\nأدخل عنوان المهمة بالعربية:', { parse_mode: 'Markdown' });

    } else if (data === 'update_status') {
      sessionState.set(chatId, 'us_code');
      await b.sendMessage(chatId, '🔄 أدخل كود المهمة لتغيير حالتها:');

    } else if (data === 'add_comment') {
      sessionState.set(chatId, 'ac_code');
      await b.sendMessage(chatId, '💬 أدخل كود المهمة لإضافة تعليق:');

    } else if (data === 'admin_depts') {
      const depts = await prisma.department.findMany({ include: { _count: { select: { users: true } } } });
      let m = `🏢 *الأقسام (${depts.length})*\n\n`;
      depts.forEach(d => { m += `• *${d.nameAr || d.name}*: ${d._count.users} موظف\n`; });
      await b.sendMessage(chatId, m, { parse_mode: 'Markdown' });
      await sendMenu(b, chatId, user);

    } else if (data.startsWith('emp_') && !data.startsWith('emp_tasks_') && !data.startsWith('emp_overdue_')) {
      await showEmpDetails(b, chatId, parseInt(data.replace('emp_', '')));
    } else if (data.startsWith('emp_tasks_')) {
      await showEmpTasks(b, chatId, parseInt(data.replace('emp_tasks_', '')));
    } else if (data.startsWith('emp_overdue_')) {
      await showEmpOverdue(b, chatId, parseInt(data.replace('emp_overdue_', '')));

    } else if (data === 'my_stats') {
      await showMyStats(b, chatId, user);
    } else if (data === 'my_tasks') {
      await showMyTasks(b, chatId, user.id);
    } else if (data === 'my_overdue') {
      await showMyOverdue(b, chatId, user.id);
    } else if (data === 'main_menu') {
      await sendMenu(b, chatId, user);
    } else if (data === 'ask_ai_btn') {
      await b.sendMessage(chatId, '🤖 *المساعد الذكي (AI)*\nهذه الميزة متاحة عبر الأمر `/ask`.\n\nاضغط على الأمر للنسخ أو اكتبه مباشرة يليه سؤالك:\n`/ask كيف أدير وقتي اليوم بشكل أفضل؟`', { parse_mode: 'Markdown' });
    }
  });

  // Text messages
  b.on('message', async (msg) => {
    if (msg.text?.startsWith('/')) return;
    const chatId = msg.chat.id;
    const text = msg.text?.trim() || '';
    const user = await getUser(chatId);

    if (!user) {
      if (awaitingUsername.has(chatId)) {
        const found = await prisma.user.findFirst({ where: { username: { equals: text, mode: 'insensitive' } }, include: { role: true } });
        if (!found || !found.isActive) {
          await b.sendMessage(chatId, '❌ اسم المستخدم غير موجود أو الحساب غير نشط. حاول مرة أخرى:');
          return;
        }
        awaitingUsername.delete(chatId);
        pendingAuth.set(chatId, found.username);
        await b.sendMessage(chatId, `✅ تم العثور على: *${found.fullNameAr}*\nأدخل كلمة المرور:`, { parse_mode: 'Markdown' });
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
          await b.sendMessage(chatId, `🎉 *أهلاً ${found.fullNameAr}!*\nتم تسجيل الدخول بنجاح.`, { parse_mode: 'Markdown' });
          await sendMenu(b, chatId, found);
        } else {
          pendingAuth.delete(chatId);
          awaitingUsername.add(chatId);
          await b.sendMessage(chatId, '❌ كلمة المرور خاطئة. أعد إدخال اسم المستخدم:');
        }
        return;
      }
      awaitingUsername.add(chatId);
      await b.sendMessage(chatId, '🔒 أرسل /start لتسجيل الدخول.');
      return;
    }

    if (sessionState.get(chatId) === 'awaiting_task_code') {
      sessionState.delete(chatId);
      await showTaskByCode(b, chatId, text, user);
      return;
    }

    if (sessionState.get(chatId) === 'search_employee') {
      sessionState.delete(chatId);
      const emp = await prisma.user.findFirst({
        where: { OR: [ { employeeCode: { equals: text, mode: 'insensitive' } }, { fullNameAr: { contains: text, mode: 'insensitive' } } ] },
        include: { role: true }
      });
      if (!emp) {
        await b.sendMessage(chatId, '❌ لم يتم العثور على موظف بهذا الاسم أو الكود.');
      } else {
        await showEmpDetails(b, chatId, emp.id);
      }
      return;
    }

    // ── Multi-step: Create Task ───────────────────────────────
    const st = sessionState.get(chatId);
    if (st?.startsWith('ct_')) {
      const d = sessionData.get(chatId) || {};
      if (st === 'ct_title') {
        d.titleAr = text;
        sessionData.set(chatId, d);
        sessionState.set(chatId, 'ct_assignee');
        await b.sendMessage(chatId, '👤 أدخل كود الموظف المسند إليه (مثال: EMP-2026-001):');
      } else if (st === 'ct_assignee') {
        const emp = await prisma.user.findFirst({ where: { employeeCode: { equals: text.trim(), mode: 'insensitive' } } });
        if (!emp) { await b.sendMessage(chatId, '❌ كود الموظف غير موجود. أعد الإدخال:'); return; }
        d.assignedToId = emp.id;
        d.assigneeName = emp.fullNameAr;
        sessionData.set(chatId, d);
        sessionState.set(chatId, 'ct_due');
        await b.sendMessage(chatId, `✅ الموظف: *${emp.fullNameAr}*\n📅 أدخل تاريخ الاستحقاق (YYYY-MM-DD) أو أرسل - لتخطيه:`, { parse_mode: 'Markdown' });
      } else if (st === 'ct_due') {
        d.dueDate = text.trim() === '-' ? undefined : text.trim();
        sessionState.delete(chatId);
        sessionData.delete(chatId);
        // Create task
        const yr = new Date().getFullYear();
        const code = `TSK-${yr}-${Math.floor(Math.random()*90000)+10000}`;
        try {
          const task = await prisma.task.create({
            data: {
              taskCode: code, title: d.titleAr, titleAr: d.titleAr,
              priority: 'MEDIUM', status: 'NEW',
              assignedToId: d.assignedToId, createdById: user.id,
              dueDate: d.dueDate ? new Date(d.dueDate) : undefined,
            },
          });
          await b.sendMessage(chatId,
            `✅ *تم إنشاء المهمة بنجاح!*\n🔖 الكود: *${task.taskCode}*\n📝 ${task.titleAr}\n👤 مسندة إلى: ${d.assigneeName}`,
            { parse_mode: 'Markdown' });
        } catch { await b.sendMessage(chatId, '❌ حدث خطأ أثناء إنشاء المهمة.'); }
        await sendMenu(b, chatId, user);
      }
      return;
    }

    // ── Multi-step: Update Status ─────────────────────────────
    if (st?.startsWith('us_')) {
      if (st === 'us_code') {
        const task = await prisma.task.findFirst({ where: { taskCode: { equals: text.trim(), mode: 'insensitive' } } });
        if (!task) { await b.sendMessage(chatId, '❌ كود غير موجود.'); return; }
        if (!isAdmin(user) && task.assignedToId !== user.id) { await b.sendMessage(chatId, '🔒 ليست مهمتك.'); return; }
        sessionData.set(chatId, { taskId: task.id, taskCode: task.taskCode });
        sessionState.set(chatId, 'us_status');
        await b.sendMessage(chatId, `📋 *${task.taskCode}* - اختر الحالة الجديدة:`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [{ text: '🔄 قيد التنفيذ', callback_data: 'set_status_IN_PROGRESS' }],
            [{ text: '👀 تحت المراجعة', callback_data: 'set_status_UNDER_REVIEW' }],
            [{ text: '✅ مكتملة', callback_data: 'set_status_COMPLETED' }],
          ]},
        });
      }
      return;
    }

    // ── Multi-step: Add Comment ───────────────────────────────
    if (st?.startsWith('ac_')) {
      if (st === 'ac_code') {
        const task = await prisma.task.findFirst({ where: { taskCode: { equals: text.trim(), mode: 'insensitive' } } });
        if (!task) { await b.sendMessage(chatId, '❌ كود غير موجود.'); return; }
        sessionData.set(chatId, { taskId: task.id, taskCode: task.taskCode });
        sessionState.set(chatId, 'ac_text');
        await b.sendMessage(chatId, `💬 أدخل نص التعليق على المهمة *${task.taskCode}*:`, { parse_mode: 'Markdown' });
      } else if (st === 'ac_text') {
        const d = sessionData.get(chatId);
        sessionState.delete(chatId); sessionData.delete(chatId);
        await prisma.taskComment.create({ data: { taskId: d.taskId, userId: user.id, commentText: text } });
        await b.sendMessage(chatId, `✅ تم إضافة التعليق على *${d.taskCode}*`, { parse_mode: 'Markdown' });
        await sendMenu(b, chatId, user);
      }
      return;
    }

    await sendMenu(b, chatId, user, 'استخدم القائمة:');
  });
}

// Handle set_status callbacks (registered via callback_query)
function registerStatusHandler(b: TelegramBot) {
  b.on('callback_query', async (query) => {
    const data = query.data || '';
    if (!data.startsWith('set_status_')) return;
    const chatId = query.message!.chat.id;
    await b.answerCallbackQuery(query.id);
    const newStatus = data.replace('set_status_', '');
    const d = sessionData.get(chatId);
    if (!d?.taskId) return;
    sessionState.delete(chatId); sessionData.delete(chatId);
    const user = await getUser(chatId);
    await prisma.task.update({ where: { id: d.taskId }, data: { status: newStatus, completedDate: newStatus === 'COMPLETED' ? new Date() : null } });
    await prisma.taskStatusHistory.create({ data: { taskId: d.taskId, toStatus: newStatus, changedById: user!.id, note: 'تحديث عبر تيليجرام' } });
    const labels: any = { IN_PROGRESS: '🔄 قيد التنفيذ', UNDER_REVIEW: '👀 تحت المراجعة', COMPLETED: '✅ مكتملة' };
    await b.sendMessage(chatId, `✅ تم تحديث حالة *${d.taskCode}* إلى ${labels[newStatus] || newStatus}`, { parse_mode: 'Markdown' });
    await sendMenu(b, chatId, user!);
  });
}

// ── Send role-based menu ──────────────────────────────────────
async function sendMenu(b: TelegramBot, chatId: number, user: any, caption?: string) {
  const name = user.fullNameAr || user.fullName || '';
  const role = user.role?.nameAr || user.role?.name || '';
  if (isAdmin(user)) {
    await b.sendMessage(chatId, caption || `📋 *القائمة الرئيسية*\n${name} | ${role}`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [{ text: '📊 إحصائيات النظام', callback_data: 'admin_stats' }],
        [{ text: '⚠️ المهام المتأخرة',  callback_data: 'admin_overdue' }],
        [{ text: '👥 قائمة الموظفين',   callback_data: 'admin_employees' }],
        [{ text: '🔍 بحث عن مهمة',     callback_data: 'admin_search' }],
        [{ text: '🏢 الأقسام',          callback_data: 'admin_depts' }],
        [{ text: '➕ إنشاء مهمة',       callback_data: 'create_task' }],
        [{ text: '🔄 تحديث حالة مهمة', callback_data: 'update_status' }],
        [{ text: '💬 إضافة تعليق',      callback_data: 'add_comment' }],
        [{ text: '🤖 اسأل المساعد الذكي', callback_data: 'ask_ai_btn' }],
      ]}
    });
  } else {
    await b.sendMessage(chatId, caption || `📋 *قائمتي*\n${name} | ${role}`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [{ text: '📊 إحصائياتي',        callback_data: 'my_stats' }],
        [{ text: '📋 مهامي',            callback_data: 'my_tasks' }],
        [{ text: '⚠️ مهامي المتأخرة',   callback_data: 'my_overdue' }],
        [{ text: '🔍 بحث عن مهمة',     callback_data: 'my_search' }],
        [{ text: '🔄 تحديث حالة مهمة', callback_data: 'update_status' }],
        [{ text: '💬 إضافة تعليق',      callback_data: 'add_comment' }],
        [{ text: '🤖 اسأل المساعد الذكي', callback_data: 'ask_ai_btn' }],
      ]}
    });
  }
}

async function showMyStats(b: TelegramBot, chatId: number, user: any) {
  const [total, done, inProg, late, review] = await Promise.all([
    prisma.task.count({ where: { assignedToId: user.id } }),
    prisma.task.count({ where: { assignedToId: user.id, status: 'COMPLETED' } }),
    prisma.task.count({ where: { assignedToId: user.id, status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { assignedToId: user.id, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED','CANCELLED'] } } }),
    prisma.task.count({ where: { assignedToId: user.id, status: 'UNDER_REVIEW' } }),
  ]);
  const rate = total > 0 ? Math.round(done / total * 100) : 0;
  await b.sendMessage(chatId,
    `📊 *إحصائياتي — ${user.fullNameAr}*\n\n` +
    `📋 إجمالي مهامي: *${total}*\n✅ مكتملة: *${done}*\n` +
    `🔄 قيد التنفيذ: *${inProg}*\n👀 تحت المراجعة: *${review}*\n` +
    `⚠️ متأخرة: *${late}*\n📈 نسبة إنجازي: *${rate}%*`,
    { parse_mode: 'Markdown' });
  await sendMenu(b, chatId, user);
}

async function showMyTasks(b: TelegramBot, chatId: number, userId: number) {
  const user = await getUser(chatId);
  const tasks = await prisma.task.findMany({ where: { assignedToId: userId }, orderBy: { createdAt: 'desc' }, take: 15 });
  if (!tasks.length) { await b.sendMessage(chatId, '📭 لا توجد مهام مسندة إليك حالياً.'); await sendMenu(b, chatId, user); return; }
  const se: Record<string, string> = { NEW:'🆕', IN_PROGRESS:'🔄', UNDER_REVIEW:'👀', REVISION_REQUIRED:'✏️', COMPLETED:'✅', CANCELLED:'❌' };
  let m = `📋 *مهامي (${tasks.length})*\n\n`;
  tasks.forEach((t, i) => {
    const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString('ar-EG') : '';
    m += `${i+1}. ${se[t.status]||'📌'} *${t.taskCode}*\n   ${t.titleAr || t.title}${due ? `\n   📅 ${due}` : ''}\n\n`;
  });
  await b.sendMessage(chatId, m, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
    [{ text: '⚠️ المتأخرة فقط', callback_data: 'my_overdue' }],
    [{ text: '🏠 القائمة', callback_data: 'main_menu' }],
  ]}});
}

async function showMyOverdue(b: TelegramBot, chatId: number, userId: number) {
  const user = await getUser(chatId);
  const tasks = await prisma.task.findMany({ where: { assignedToId: userId, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED','CANCELLED'] } }, orderBy: { dueDate: 'asc' } });
  if (!tasks.length) { await b.sendMessage(chatId, '🎉 رائع! لا توجد مهام متأخرة عليك.'); }
  else {
    let m = `⚠️ *مهامي المتأخرة (${tasks.length})*\n\n`;
    tasks.forEach((t, i) => { const d = Math.floor((Date.now() - new Date(t.dueDate!).getTime()) / 86400000); m += `${i+1}. *${t.taskCode}* - ${t.titleAr || t.title}\n   تأخرت *${d}* ${d===1?'يوم':'أيام'} ‼️\n\n`; });
    await b.sendMessage(chatId, m, { parse_mode: 'Markdown' });
  }
  await sendMenu(b, chatId, user);
}

async function showTaskByCode(b: TelegramBot, chatId: number, code: string, currentUser: any) {
  const task = await prisma.task.findFirst({
    where: { taskCode: { equals: code.trim(), mode: 'insensitive' } },
    include: { assignedTo: { include: { department: true } }, createdBy: true },
  });
  if (!task) { await b.sendMessage(chatId, `❌ لم أجد مهمة بكود *${code}*`, { parse_mode: 'Markdown' }); await sendMenu(b, chatId, currentUser); return; }
  if (!isAdmin(currentUser) && task.assignedToId !== currentUser.id) { await b.sendMessage(chatId, '🔒 هذه المهمة ليست مسندة إليك.'); await sendMenu(b, chatId, currentUser); return; }

  const sm: Record<string,string> = { NEW:'🆕 جديدة', IN_PROGRESS:'🔄 قيد التنفيذ', UNDER_REVIEW:'👀 تحت المراجعة', REVISION_REQUIRED:'✏️ تحتاج تعديل', COMPLETED:'✅ مكتملة', CANCELLED:'❌ ملغاة' };
  const pm: Record<string,string> = { LOW:'🟢 منخفضة', MEDIUM:'🟡 متوسطة', HIGH:'🔴 عالية', URGENT:'🚨 عاجلة' };
  const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-EG') : 'غير محدد';
  const isLate = task.dueDate && task.dueDate < new Date() && task.status !== 'COMPLETED';
  const days = task.dueDate ? Math.floor((Date.now() - new Date(task.dueDate).getTime()) / 86400000) : 0;

  let m = `🗂️ *${task.taskCode}*\n📝 ${task.titleAr || task.title}\n\n🏷️ ${sm[task.status]||task.status}\n⚡ ${pm[task.priority]||task.priority}\n⏰ الاستحقاق: *${due}*\n📈 الإنجاز: *${task.progressPercent??0}%*\n`;
  if (isLate) m += `🚨 متأخرة *${days}* ${days===1?'يوم':'أيام'}!\n`;
  m += `\n👤 ${task.assignedTo.fullNameAr} — ${task.assignedTo.department?.nameAr || ''}`;

  await b.sendMessage(chatId, m, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🏠 القائمة', callback_data: 'main_menu' }]] } });
}

async function showEmpDetails(b: TelegramBot, chatId: number, empId: number) {
  const emp = await prisma.user.findUnique({ where: { id: empId }, include: { role: true, department: true } });
  if (!emp) return;
  const [total, done, late] = await Promise.all([
    prisma.task.count({ where: { assignedToId: empId } }),
    prisma.task.count({ where: { assignedToId: empId, status: 'COMPLETED' } }),
    prisma.task.count({ where: { assignedToId: empId, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED','CANCELLED'] } } }),
  ]);
  const rate = total > 0 ? Math.round(done / total * 100) : 0;
  await b.sendMessage(chatId,
    `👤 *${emp.fullNameAr}*\n🏷️ ${emp.role.nameAr || emp.role.name}\n🏢 ${emp.department?.nameAr || 'بدون قسم'}\n` +
    `📋 مهام: *${total}* | ✅ *${done}* | ⚠️ *${late}*\n📈 الإنجاز: *${rate}%*\n📧 ${emp.email || '—'}`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
      [{ text: '📋 كل مهامه', callback_data: `emp_tasks_${empId}` }, { text: '⚠️ المتأخرة', callback_data: `emp_overdue_${empId}` }],
      [{ text: '🔙 الموظفون', callback_data: 'admin_employees' }, { text: '🏠 القائمة', callback_data: 'main_menu' }],
    ]}});
}

async function showEmpTasks(b: TelegramBot, chatId: number, empId: number) {
  const emp = await prisma.user.findUnique({ where: { id: empId } });
  const tasks = await prisma.task.findMany({ where: { assignedToId: empId }, orderBy: { createdAt: 'desc' }, take: 10 });
  if (!tasks.length) { await b.sendMessage(chatId, `لا توجد مهام لـ *${emp?.fullNameAr}*`, { parse_mode: 'Markdown' }); return; }
  const se: Record<string,string> = { NEW:'🆕', IN_PROGRESS:'🔄', UNDER_REVIEW:'👀', COMPLETED:'✅', CANCELLED:'❌', REVISION_REQUIRED:'✏️' };
  let m = `📋 *مهام ${emp?.fullNameAr}*\n\n`;
  tasks.forEach((t, i) => { m += `${i+1}. ${se[t.status]||'📌'} *${t.taskCode}* - ${t.titleAr || t.title}\n`; });
  await b.sendMessage(chatId, m, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: `emp_${empId}` }]] } });
}

async function showEmpOverdue(b: TelegramBot, chatId: number, empId: number) {
  const emp = await prisma.user.findUnique({ where: { id: empId } });
  const tasks = await prisma.task.findMany({ where: { assignedToId: empId, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED','CANCELLED'] } }, orderBy: { dueDate: 'asc' } });
  if (!tasks.length) { await b.sendMessage(chatId, `🎉 لا توجد مهام متأخرة لـ *${emp?.fullNameAr}*`, { parse_mode: 'Markdown' }); }
  else {
    let m = `⚠️ *متأخرات ${emp?.fullNameAr} (${tasks.length})*\n\n`;
    tasks.forEach((t, i) => { const d = Math.floor((Date.now() - new Date(t.dueDate!).getTime()) / 86400000); m += `${i+1}. *${t.taskCode}* - ${t.titleAr || t.title}\n   تأخر *${d}* يوم\n\n`; });
    await b.sendMessage(chatId, m, { parse_mode: 'Markdown' });
  }
  await b.sendMessage(chatId, '↩️', { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: `emp_${empId}` }, { text: '🏠 القائمة', callback_data: 'main_menu' }]] } });
}

async function getUser(chatId: number) {
  return prisma.user.findUnique({ where: { telegramChatId: String(chatId) }, include: { role: true } });
}

async function getSystemStats() {
  const now = new Date();
  const [totalTasks, completedTasks, inProgressTasks, overdueTasks, totalUsers, totalDepts] = await Promise.all([
    prisma.task.count(),
    prisma.task.count({ where: { status: 'COMPLETED' } }),
    prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { dueDate: { lt: now }, status: { notIn: ['COMPLETED','CANCELLED'] } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.department.count(),
  ]);
  return { totalTasks, completedTasks, inProgressTasks, overdueTasks, totalUsers, totalDepts, completionRate: totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0 };
}

async function getOverdueTasks() {
  return prisma.task.findMany({ where: { dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED','CANCELLED'] } }, include: { assignedTo: true }, orderBy: { dueDate: 'asc' } });
}
