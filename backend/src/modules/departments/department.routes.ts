import { Router } from 'express';
import { departmentController } from './department.controller';
import { authenticate, authorizeLevel } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/tree', departmentController.getTree);
router.get('/',     departmentController.getAll);
router.post('/',    authorizeLevel(2), departmentController.create);
router.put('/:id',  authorizeLevel(2), departmentController.update);
router.delete('/:id', authorizeLevel(1), departmentController.delete);

export default router;
