import { Router } from 'express';
import { taskController, uploadAttachment } from './task.controller';
import { authenticate, authorizeLevel } from '../../middleware/auth';
import checklistRouter from './checklist.routes';
import templateRouter from './template.routes';

const router = Router();
router.use(authenticate);

// ── Main task routes ──────────────────────────────────────────
router.get('/dashboard',              taskController.getDashboard);
router.get('/categories',             taskController.getCategories);
router.get('/calendar',               taskController.getCalendar);
router.get('/',                       taskController.getAll);
router.get('/:id',                    taskController.getById);
router.post('/',                      authorizeLevel(3), taskController.create);
router.patch('/:id/status',           taskController.updateStatus);
router.patch('/:id/progress',         taskController.updateProgress);
router.post('/:id/comments',          taskController.addComment);
router.post('/:id/attachments',       uploadAttachment.single('file'), taskController.addAttachment);
router.delete('/:id',                 authorizeLevel(1), taskController.delete);

// ── Checklist (sub-tasks) ─────────────────────────────────────
router.use('/tasks', checklistRouter);

// ── Templates ─────────────────────────────────────────────────
router.use('/templates', templateRouter);

export default router;
