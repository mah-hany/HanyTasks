import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import departmentRoutes from './modules/departments/department.routes';
import taskRoutes from './modules/tasks/task.routes';
import templateRoutes from './modules/tasks/template.routes';
import checklistRoutes from './modules/tasks/checklist.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import reportRoutes from './modules/reports/report.routes';
import auditRoutes from './modules/audit/audit.routes';
import settingRoutes from './modules/settings/settings.routes';
import exportRoutes from './modules/export/export.routes';
import timeRoutes from './modules/time/time.routes';
import gamificationRoutes from './modules/gamification/gamification.routes';
import { handleTelegramWebhook } from './modules/telegram/telegram.bot';

const app = express();

// ── Security Headers (Helmet) ──────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow uploads to be served
}));

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:4200',
      'https://hany-tasks.vercel.app',
    ];
    if (!origin || allowed.includes(origin) || /\.vercel\.app$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ── Global Rate Limiter ────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,                  // max 300 requests per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// ── Strict Rate Limiter for Auth ───────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 login attempts per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
});

app.use(globalLimiter);
app.use(express.json({ limit: '10mb' }));   // reduced from 50mb
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Static files (uploads) — no directory listing
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  index: false,
  dotfiles: 'deny',
}));

// ── API Routes ────────────────────────────────────────────

app.get('/api/test-email', async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: +(process.env.SMTP_PORT || 465),
      secure: true, // SSL
      auth: {
        user: 'mh.abdel.karim1997@gmail.com',
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      const info = await transporter.sendMail({
        from: '"Hany Tasks Diagnostic" <mh.abdel.karim1997@gmail.com>',
        to: 'mh.abdel.karim1997@gmail.com',
        subject: 'Live Email Diagnostic Test',
        text: 'If you see this, email is working.',
      });
      res.json({ success: true, info });
    } catch (e: any) {
      res.json({ success: false, error: e.message, code: e.code, command: e.command });
    }
  } catch (e: any) {
    res.json({ success: false, wrapperError: e.message });
  }
});

app.use('/api/auth',          authLimiter, authRoutes);   // strict limit on auth
app.use('/api/users',         userRoutes);
app.use('/api/departments',   departmentRoutes);
app.use('/api/tasks',         taskRoutes);
app.use('/api/tasks',         checklistRoutes);  // checklist sub-routes (/:taskId/checklist)
app.use('/api/templates',     templateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/audit',         auditRoutes);
app.use('/api/settings',      settingRoutes);
app.use('/api/export',        exportRoutes);
app.use('/api/time',          timeRoutes);
app.use('/api/gamification',  gamificationRoutes);

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
}, handleTelegramWebhook);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), app: 'TaskFlow Pro API' });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
