"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTelegramBot = getTelegramBot;
exports.initTelegramBot = initTelegramBot;
exports.handleTelegramWebhook = handleTelegramWebhook;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const client_1 = __importDefault(require("../../prisma/client"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const https_1 = __importDefault(require("https"));
const pendingAuth = new Map();
const awaitingUsername = new Set();
const sessionState = new Map();
let bot = null;
function isAdmin(user) { return user?.role?.level <= 2; }
/** Called from app.ts to register the webhook route */
function getTelegramBot() { return bot; }
/** Set Telegram webhook via raw HTTPS */
function setWebhook(token, webhookUrl) {
    return new Promise((resolve) => {
        const url = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true&allowed_updates=["message","callback_query"]`;
        https_1.default.get(url, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => { console.log('Webhook set:', data); resolve(); });
        }).on('error', (e) => { console.warn('setWebhook error:', e.message); resolve(); });
    });
}
/** Delete webhook (for local dev polling mode) */
function deleteWebhook(token) {
    return new Promise((resolve) => {
        const url = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
        https_1.default.get(url, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => { console.log('Webhook deleted:', data); resolve(); });
        }).on('error', (e) => { console.warn('deleteWebhook error:', e.message); resolve(); });
    });
}
async function initTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.warn('⚠️  TELEGRAM_BOT_TOKEN not set — bot disabled');
        return;
    }
    const isProduction = process.env.NODE_ENV === 'production';
    const appUrl = process.env.APP_URL || 'https://hanytasks.onrender.com';
    if (isProduction) {
        // ── PRODUCTION: use Webhook ──────────────────────────────
        bot = new node_telegram_bot_api_1.default(token); // no polling
        const webhookUrl = `${appUrl}/api/telegram/webhook`;
        await setWebhook(token, webhookUrl);
        console.log(`✅ Telegram Bot webhook set: ${webhookUrl}`);
    }
    else {
        // ── LOCAL DEV: use Polling ───────────────────────────────
        await deleteWebhook(token);
        bot = new node_telegram_bot_api_1.default(token, {
            polling: { interval: 1000, autoStart: true, params: { timeout: 10, allowed_updates: ['message', 'callback_query'] } }
        });
        bot.on('polling_error', (err) => console.error('Polling error:', err.message));
        console.log('✅ Telegram Bot polling started (dev mode).');
    }
    registerHandlers(bot);
}
/** Express route handler — called from app.ts for POST /api/telegram/webhook */
function handleTelegramWebhook(req, res) {
    res.sendStatus(200); // always respond immediately
    if (bot)
        bot.processUpdate(req.body);
}
// ── Register all bot handlers ─────────────────────────────────
function registerHandlers(b) {
    // /start
    b.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const user = await getUser(chatId);
        if (user) {
            await b.sendMessage(chatId, `👋 مرحباً بعودتك *${user.fullNameAr}*!`, { parse_mode: 'Markdown' });
            await sendMenu(b, chatId, user);
        }
        else {
            awaitingUsername.add(chatId);
            await b.sendMessage(chatId, '🔐 *مرحباً في TaskFlow Pro Bot*\n\nيمكن لجميع الموظفين استخدام البوت.\nأدخل اسم المستخدم (Username):', { parse_mode: 'Markdown' });
        }
    });
    // /logout
    b.onText(/\/logout/, async (msg) => {
        const chatId = msg.chat.id;
        await client_1.default.user.updateMany({ where: { telegramChatId: String(chatId) }, data: { telegramChatId: null } });
        pendingAuth.delete(chatId);
        awaitingUsername.delete(chatId);
        sessionState.delete(chatId);
        awaitingUsername.add(chatId);
        await b.sendMessage(chatId, '👋 تم تسجيل الخروج. أرسل /start للدخول مجدداً.');
    });
    // Callback queries
    b.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data || '';
        await b.answerCallbackQuery(query.id);
        const user = await getUser(chatId);
        if (!user) {
            await b.sendMessage(chatId, '🔒 أرسل /start لتسجيل الدخول');
            return;
        }
        if (data === 'admin_stats') {
            const s = await getSystemStats();
            await b.sendMessage(chatId, `📊 *إحصائيات النظام*\n\n` +
                `📋 إجمالي المهام: *${s.totalTasks}*\n✅ مكتملة: *${s.completedTasks}*\n` +
                `🔄 قيد التنفيذ: *${s.inProgressTasks}*\n⚠️ متأخرة: *${s.overdueTasks}*\n` +
                `📈 نسبة الإنجاز: *${s.completionRate}%*\n👥 الموظفون: *${s.totalUsers}*\n🏢 الأقسام: *${s.totalDepts}*`, { parse_mode: 'Markdown' });
            await sendMenu(b, chatId, user);
        }
        else if (data === 'admin_overdue') {
            const tasks = await getOverdueTasks();
            if (!tasks.length) {
                await b.sendMessage(chatId, '🎉 لا توجد مهام متأخرة!');
            }
            else {
                let m = `⚠️ *المهام المتأخرة (${tasks.length})*\n\n`;
                tasks.slice(0, 15).forEach((t, i) => {
                    const d = Math.floor((Date.now() - new Date(t.dueDate).getTime()) / 86400000);
                    m += `${i + 1}. *${t.taskCode}* - ${t.titleAr || t.title}\n   👤 ${t.assignedTo.fullNameAr} | تأخر *${d}* يوم\n\n`;
                });
                await b.sendMessage(chatId, m, { parse_mode: 'Markdown' });
            }
            await sendMenu(b, chatId, user);
        }
        else if (data === 'admin_employees') {
            const emps = await client_1.default.user.findMany({ where: { isActive: true }, include: { role: true }, orderBy: { fullNameAr: 'asc' } });
            const btns = emps.slice(0, 20).map(e => ([{ text: `👤 ${e.fullNameAr} (${e.role.nameAr || e.role.name})`, callback_data: `emp_${e.id}` }]));
            btns.push([{ text: '🏠 القائمة', callback_data: 'main_menu' }]);
            await b.sendMessage(chatId, `👥 *الموظفون النشطون (${emps.length})*\nاختر موظفاً:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
        }
        else if (data === 'admin_search' || data === 'my_search') {
            sessionState.set(chatId, 'awaiting_task_code');
            await b.sendMessage(chatId, '🔍 أدخل كود المهمة (مثال: TSK-2026-001):');
        }
        else if (data === 'admin_depts') {
            const depts = await client_1.default.department.findMany({ include: { _count: { select: { users: true } } } });
            let m = `🏢 *الأقسام (${depts.length})*\n\n`;
            depts.forEach(d => { m += `• *${d.nameAr || d.name}*: ${d._count.users} موظف\n`; });
            await b.sendMessage(chatId, m, { parse_mode: 'Markdown' });
            await sendMenu(b, chatId, user);
        }
        else if (data.startsWith('emp_') && !data.startsWith('emp_tasks_') && !data.startsWith('emp_overdue_')) {
            await showEmpDetails(b, chatId, parseInt(data.replace('emp_', '')));
        }
        else if (data.startsWith('emp_tasks_')) {
            await showEmpTasks(b, chatId, parseInt(data.replace('emp_tasks_', '')));
        }
        else if (data.startsWith('emp_overdue_')) {
            await showEmpOverdue(b, chatId, parseInt(data.replace('emp_overdue_', '')));
        }
        else if (data === 'my_stats') {
            await showMyStats(b, chatId, user);
        }
        else if (data === 'my_tasks') {
            await showMyTasks(b, chatId, user.id);
        }
        else if (data === 'my_overdue') {
            await showMyOverdue(b, chatId, user.id);
        }
        else if (data === 'main_menu') {
            await sendMenu(b, chatId, user);
        }
    });
    // Text messages
    b.on('message', async (msg) => {
        if (msg.text?.startsWith('/'))
            return;
        const chatId = msg.chat.id;
        const text = msg.text?.trim() || '';
        const user = await getUser(chatId);
        if (!user) {
            if (awaitingUsername.has(chatId)) {
                const found = await client_1.default.user.findFirst({ where: { username: { equals: text, mode: 'insensitive' } }, include: { role: true } });
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
                const username = pendingAuth.get(chatId);
                const found = await client_1.default.user.findUnique({ where: { username }, include: { role: true } });
                if (!found)
                    return;
                const ok = await bcryptjs_1.default.compare(text, found.passwordHash);
                if (ok) {
                    await client_1.default.user.update({ where: { id: found.id }, data: { telegramChatId: String(chatId) } });
                    pendingAuth.delete(chatId);
                    await b.sendMessage(chatId, `🎉 *أهلاً ${found.fullNameAr}!*\nتم تسجيل الدخول بنجاح.`, { parse_mode: 'Markdown' });
                    await sendMenu(b, chatId, found);
                }
                else {
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
        await sendMenu(b, chatId, user, 'استخدم القائمة:');
    });
}
// ── Send role-based menu ──────────────────────────────────────
async function sendMenu(b, chatId, user, caption) {
    const name = user.fullNameAr || user.fullName || '';
    const role = user.role?.nameAr || user.role?.name || '';
    if (isAdmin(user)) {
        await b.sendMessage(chatId, caption || `📋 *القائمة الرئيسية*\n${name} | ${role}`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [
                    [{ text: '📊 إحصائيات النظام', callback_data: 'admin_stats' }],
                    [{ text: '⚠️ المهام المتأخرة', callback_data: 'admin_overdue' }],
                    [{ text: '👥 قائمة الموظفين', callback_data: 'admin_employees' }],
                    [{ text: '🔍 بحث عن مهمة', callback_data: 'admin_search' }],
                    [{ text: '🏢 الأقسام', callback_data: 'admin_depts' }],
                ] }
        });
    }
    else {
        await b.sendMessage(chatId, caption || `📋 *قائمتي*\n${name} | ${role}`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [
                    [{ text: '📊 إحصائياتي', callback_data: 'my_stats' }],
                    [{ text: '📋 مهامي', callback_data: 'my_tasks' }],
                    [{ text: '⚠️ مهامي المتأخرة', callback_data: 'my_overdue' }],
                    [{ text: '🔍 بحث عن مهمة', callback_data: 'my_search' }],
                ] }
        });
    }
}
async function showMyStats(b, chatId, user) {
    const [total, done, inProg, late, review] = await Promise.all([
        client_1.default.task.count({ where: { assignedToId: user.id } }),
        client_1.default.task.count({ where: { assignedToId: user.id, status: 'COMPLETED' } }),
        client_1.default.task.count({ where: { assignedToId: user.id, status: 'IN_PROGRESS' } }),
        client_1.default.task.count({ where: { assignedToId: user.id, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
        client_1.default.task.count({ where: { assignedToId: user.id, status: 'UNDER_REVIEW' } }),
    ]);
    const rate = total > 0 ? Math.round(done / total * 100) : 0;
    await b.sendMessage(chatId, `📊 *إحصائياتي — ${user.fullNameAr}*\n\n` +
        `📋 إجمالي مهامي: *${total}*\n✅ مكتملة: *${done}*\n` +
        `🔄 قيد التنفيذ: *${inProg}*\n👀 تحت المراجعة: *${review}*\n` +
        `⚠️ متأخرة: *${late}*\n📈 نسبة إنجازي: *${rate}%*`, { parse_mode: 'Markdown' });
    await sendMenu(b, chatId, user);
}
async function showMyTasks(b, chatId, userId) {
    const user = await getUser(chatId);
    const tasks = await client_1.default.task.findMany({ where: { assignedToId: userId }, orderBy: { createdAt: 'desc' }, take: 15 });
    if (!tasks.length) {
        await b.sendMessage(chatId, '📭 لا توجد مهام مسندة إليك حالياً.');
        await sendMenu(b, chatId, user);
        return;
    }
    const se = { NEW: '🆕', IN_PROGRESS: '🔄', UNDER_REVIEW: '👀', REVISION_REQUIRED: '✏️', COMPLETED: '✅', CANCELLED: '❌' };
    let m = `📋 *مهامي (${tasks.length})*\n\n`;
    tasks.forEach((t, i) => {
        const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString('ar-EG') : '';
        m += `${i + 1}. ${se[t.status] || '📌'} *${t.taskCode}*\n   ${t.titleAr || t.title}${due ? `\n   📅 ${due}` : ''}\n\n`;
    });
    await b.sendMessage(chatId, m, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
                [{ text: '⚠️ المتأخرة فقط', callback_data: 'my_overdue' }],
                [{ text: '🏠 القائمة', callback_data: 'main_menu' }],
            ] } });
}
async function showMyOverdue(b, chatId, userId) {
    const user = await getUser(chatId);
    const tasks = await client_1.default.task.findMany({ where: { assignedToId: userId, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, orderBy: { dueDate: 'asc' } });
    if (!tasks.length) {
        await b.sendMessage(chatId, '🎉 رائع! لا توجد مهام متأخرة عليك.');
    }
    else {
        let m = `⚠️ *مهامي المتأخرة (${tasks.length})*\n\n`;
        tasks.forEach((t, i) => { const d = Math.floor((Date.now() - new Date(t.dueDate).getTime()) / 86400000); m += `${i + 1}. *${t.taskCode}* - ${t.titleAr || t.title}\n   تأخرت *${d}* ${d === 1 ? 'يوم' : 'أيام'} ‼️\n\n`; });
        await b.sendMessage(chatId, m, { parse_mode: 'Markdown' });
    }
    await sendMenu(b, chatId, user);
}
async function showTaskByCode(b, chatId, code, currentUser) {
    const task = await client_1.default.task.findFirst({
        where: { taskCode: { equals: code.trim(), mode: 'insensitive' } },
        include: { assignedTo: { include: { department: true } }, createdBy: true },
    });
    if (!task) {
        await b.sendMessage(chatId, `❌ لم أجد مهمة بكود *${code}*`, { parse_mode: 'Markdown' });
        await sendMenu(b, chatId, currentUser);
        return;
    }
    if (!isAdmin(currentUser) && task.assignedToId !== currentUser.id) {
        await b.sendMessage(chatId, '🔒 هذه المهمة ليست مسندة إليك.');
        await sendMenu(b, chatId, currentUser);
        return;
    }
    const sm = { NEW: '🆕 جديدة', IN_PROGRESS: '🔄 قيد التنفيذ', UNDER_REVIEW: '👀 تحت المراجعة', REVISION_REQUIRED: '✏️ تحتاج تعديل', COMPLETED: '✅ مكتملة', CANCELLED: '❌ ملغاة' };
    const pm = { LOW: '🟢 منخفضة', MEDIUM: '🟡 متوسطة', HIGH: '🔴 عالية', URGENT: '🚨 عاجلة' };
    const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-EG') : 'غير محدد';
    const isLate = task.dueDate && task.dueDate < new Date() && task.status !== 'COMPLETED';
    const days = task.dueDate ? Math.floor((Date.now() - new Date(task.dueDate).getTime()) / 86400000) : 0;
    let m = `🗂️ *${task.taskCode}*\n📝 ${task.titleAr || task.title}\n\n🏷️ ${sm[task.status] || task.status}\n⚡ ${pm[task.priority] || task.priority}\n⏰ الاستحقاق: *${due}*\n📈 الإنجاز: *${task.progressPercent ?? 0}%*\n`;
    if (isLate)
        m += `🚨 متأخرة *${days}* ${days === 1 ? 'يوم' : 'أيام'}!\n`;
    m += `\n👤 ${task.assignedTo.fullNameAr} — ${task.assignedTo.department?.nameAr || ''}`;
    await b.sendMessage(chatId, m, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🏠 القائمة', callback_data: 'main_menu' }]] } });
}
async function showEmpDetails(b, chatId, empId) {
    const emp = await client_1.default.user.findUnique({ where: { id: empId }, include: { role: true, department: true } });
    if (!emp)
        return;
    const [total, done, late] = await Promise.all([
        client_1.default.task.count({ where: { assignedToId: empId } }),
        client_1.default.task.count({ where: { assignedToId: empId, status: 'COMPLETED' } }),
        client_1.default.task.count({ where: { assignedToId: empId, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    ]);
    const rate = total > 0 ? Math.round(done / total * 100) : 0;
    await b.sendMessage(chatId, `👤 *${emp.fullNameAr}*\n🏷️ ${emp.role.nameAr || emp.role.name}\n🏢 ${emp.department?.nameAr || 'بدون قسم'}\n` +
        `📋 مهام: *${total}* | ✅ *${done}* | ⚠️ *${late}*\n📈 الإنجاز: *${rate}%*\n📧 ${emp.email || '—'}`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
                [{ text: '📋 كل مهامه', callback_data: `emp_tasks_${empId}` }, { text: '⚠️ المتأخرة', callback_data: `emp_overdue_${empId}` }],
                [{ text: '🔙 الموظفون', callback_data: 'admin_employees' }, { text: '🏠 القائمة', callback_data: 'main_menu' }],
            ] } });
}
async function showEmpTasks(b, chatId, empId) {
    const emp = await client_1.default.user.findUnique({ where: { id: empId } });
    const tasks = await client_1.default.task.findMany({ where: { assignedToId: empId }, orderBy: { createdAt: 'desc' }, take: 10 });
    if (!tasks.length) {
        await b.sendMessage(chatId, `لا توجد مهام لـ *${emp?.fullNameAr}*`, { parse_mode: 'Markdown' });
        return;
    }
    const se = { NEW: '🆕', IN_PROGRESS: '🔄', UNDER_REVIEW: '👀', COMPLETED: '✅', CANCELLED: '❌', REVISION_REQUIRED: '✏️' };
    let m = `📋 *مهام ${emp?.fullNameAr}*\n\n`;
    tasks.forEach((t, i) => { m += `${i + 1}. ${se[t.status] || '📌'} *${t.taskCode}* - ${t.titleAr || t.title}\n`; });
    await b.sendMessage(chatId, m, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: `emp_${empId}` }]] } });
}
async function showEmpOverdue(b, chatId, empId) {
    const emp = await client_1.default.user.findUnique({ where: { id: empId } });
    const tasks = await client_1.default.task.findMany({ where: { assignedToId: empId, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, orderBy: { dueDate: 'asc' } });
    if (!tasks.length) {
        await b.sendMessage(chatId, `🎉 لا توجد مهام متأخرة لـ *${emp?.fullNameAr}*`, { parse_mode: 'Markdown' });
    }
    else {
        let m = `⚠️ *متأخرات ${emp?.fullNameAr} (${tasks.length})*\n\n`;
        tasks.forEach((t, i) => { const d = Math.floor((Date.now() - new Date(t.dueDate).getTime()) / 86400000); m += `${i + 1}. *${t.taskCode}* - ${t.titleAr || t.title}\n   تأخر *${d}* يوم\n\n`; });
        await b.sendMessage(chatId, m, { parse_mode: 'Markdown' });
    }
    await b.sendMessage(chatId, '↩️', { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: `emp_${empId}` }, { text: '🏠 القائمة', callback_data: 'main_menu' }]] } });
}
async function getUser(chatId) {
    return client_1.default.user.findUnique({ where: { telegramChatId: String(chatId) }, include: { role: true } });
}
async function getSystemStats() {
    const now = new Date();
    const [totalTasks, completedTasks, inProgressTasks, overdueTasks, totalUsers, totalDepts] = await Promise.all([
        client_1.default.task.count(),
        client_1.default.task.count({ where: { status: 'COMPLETED' } }),
        client_1.default.task.count({ where: { status: 'IN_PROGRESS' } }),
        client_1.default.task.count({ where: { dueDate: { lt: now }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
        client_1.default.user.count({ where: { isActive: true } }),
        client_1.default.department.count(),
    ]);
    return { totalTasks, completedTasks, inProgressTasks, overdueTasks, totalUsers, totalDepts, completionRate: totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0 };
}
async function getOverdueTasks() {
    return client_1.default.task.findMany({ where: { dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, include: { assignedTo: true }, orderBy: { dueDate: 'asc' } });
}
//# sourceMappingURL=telegram.bot.js.map