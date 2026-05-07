"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const task_controller_1 = require("./task.controller");
const auth_1 = require("../../middleware/auth");
const checklist_routes_1 = __importDefault(require("./checklist.routes"));
const template_routes_1 = __importDefault(require("./template.routes"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// ── Main task routes ──────────────────────────────────────────
router.get('/dashboard', task_controller_1.taskController.getDashboard);
router.get('/categories', task_controller_1.taskController.getCategories);
router.get('/calendar', task_controller_1.taskController.getCalendar);
router.get('/', task_controller_1.taskController.getAll);
router.get('/:id', task_controller_1.taskController.getById);
router.post('/', (0, auth_1.authorizeLevel)(3), task_controller_1.taskController.create);
router.patch('/:id/status', task_controller_1.taskController.updateStatus);
router.patch('/:id/progress', task_controller_1.taskController.updateProgress);
router.post('/:id/comments', task_controller_1.taskController.addComment);
router.post('/:id/attachments', task_controller_1.uploadAttachment.single('file'), task_controller_1.taskController.addAttachment);
router.delete('/:id', (0, auth_1.authorizeLevel)(1), task_controller_1.taskController.delete);
// ── Checklist (sub-tasks) ─────────────────────────────────────
router.use('/tasks', checklist_routes_1.default);
// ── Templates ─────────────────────────────────────────────────
router.use('/templates', template_routes_1.default);
exports.default = router;
//# sourceMappingURL=task.routes.js.map