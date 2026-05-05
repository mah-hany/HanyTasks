"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const task_controller_1 = require("./task.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/dashboard', task_controller_1.taskController.getDashboard);
router.get('/categories', task_controller_1.taskController.getCategories);
router.get('/', task_controller_1.taskController.getAll);
router.get('/:id', task_controller_1.taskController.getById);
router.post('/', (0, auth_1.authorizeLevel)(3), task_controller_1.taskController.create);
router.patch('/:id/status', task_controller_1.taskController.updateStatus);
router.patch('/:id/progress', task_controller_1.taskController.updateProgress);
router.post('/:id/comments', task_controller_1.taskController.addComment);
router.post('/:id/attachments', task_controller_1.uploadAttachment.single('file'), task_controller_1.taskController.addAttachment);
router.delete('/:id', (0, auth_1.authorizeLevel)(1), task_controller_1.taskController.delete);
exports.default = router;
//# sourceMappingURL=task.routes.js.map