"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const requestLogger_1 = require("./middleware/requestLogger");
const errorHandler_1 = require("./middleware/errorHandler");
// Routes
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const user_routes_1 = __importDefault(require("./modules/users/user.routes"));
const department_routes_1 = __importDefault(require("./modules/departments/department.routes"));
const task_routes_1 = __importDefault(require("./modules/tasks/task.routes"));
const notification_routes_1 = __importDefault(require("./modules/notifications/notification.routes"));
const report_routes_1 = __importDefault(require("./modules/reports/report.routes"));
const audit_routes_1 = __importDefault(require("./modules/audit/audit.routes"));
const settings_routes_1 = __importDefault(require("./modules/settings/settings.routes"));
const app = (0, express_1.default)();
// ── Middleware ────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestLogger_1.requestLogger);
// Static files (uploads)
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// ── API Routes ────────────────────────────────────────────
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/departments', department_routes_1.default);
app.use('/api/tasks', task_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/reports', report_routes_1.default);
app.use('/api/audit', audit_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date(), app: 'TaskFlow Pro API' });
});
// Error handler (must be last)
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map