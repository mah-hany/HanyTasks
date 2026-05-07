"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const requestLogger_1 = require("./middleware/requestLogger");
const errorHandler_1 = require("./middleware/errorHandler");
// Routes
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const user_routes_1 = __importDefault(require("./modules/users/user.routes"));
const department_routes_1 = __importDefault(require("./modules/departments/department.routes"));
const task_routes_1 = __importDefault(require("./modules/tasks/task.routes"));
const template_routes_1 = __importDefault(require("./modules/tasks/template.routes"));
const notification_routes_1 = __importDefault(require("./modules/notifications/notification.routes"));
const report_routes_1 = __importDefault(require("./modules/reports/report.routes"));
const audit_routes_1 = __importDefault(require("./modules/audit/audit.routes"));
const settings_routes_1 = __importDefault(require("./modules/settings/settings.routes"));
const export_routes_1 = __importDefault(require("./modules/export/export.routes"));
const telegram_bot_1 = require("./modules/telegram/telegram.bot");
const app = (0, express_1.default)();
// ── Security Headers (Helmet) ──────────────────────────────
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow uploads to be served
}));
// ── CORS ──────────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowed = [
            'http://localhost:4200',
            'https://hany-tasks.vercel.app',
        ];
        if (!origin || allowed.includes(origin) || /\.vercel\.app$/.test(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
// ── Global Rate Limiter ────────────────────────────────────
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // max 300 requests per IP per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
});
// ── Strict Rate Limiter for Auth ───────────────────────────
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // max 20 login attempts per IP per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
});
app.use(globalLimiter);
app.use(express_1.default.json({ limit: '10mb' })); // reduced from 50mb
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger_1.requestLogger);
// Static files (uploads) — no directory listing
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads'), {
    index: false,
    dotfiles: 'deny',
}));
// ── API Routes ────────────────────────────────────────────
app.use('/api/auth', authLimiter, auth_routes_1.default); // strict limit on auth
app.use('/api/users', user_routes_1.default);
app.use('/api/departments', department_routes_1.default);
app.use('/api/tasks', task_routes_1.default);
app.use('/api/templates', template_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/reports', report_routes_1.default);
app.use('/api/audit', audit_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
app.use('/api/export', export_routes_1.default);
// ── Telegram Webhook (secret token validation) ─────────────
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
app.post('/api/telegram/webhook', (req, res, next) => {
    if (WEBHOOK_SECRET) {
        const incoming = req.headers['x-telegram-bot-api-secret-token'];
        if (incoming !== WEBHOOK_SECRET) {
            return res.sendStatus(403);
        }
    }
    next();
}, telegram_bot_1.handleTelegramWebhook);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date(), app: 'TaskFlow Pro API' });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});
// Error handler (must be last)
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map