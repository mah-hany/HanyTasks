import { Request, Response, NextFunction } from 'express';
import { departmentService } from './department.service';

export const departmentController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await departmentService.getAll() }); }
    catch (e) { next(e); }
  },
  async getTree(_req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await departmentService.getTree() }); }
    catch (e) { next(e); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json({ success: true, data: await departmentService.create(req.body) }); }
    catch (e) { next(e); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await departmentService.update(+req.params.id, req.body) }); }
    catch (e) { next(e); }
  },
  async delete(req: Request, res: Response, next: NextFunction) {
    try { res.json({ success: true, data: await departmentService.delete(+req.params.id) }); }
    catch (e) { next(e); }
  },
};
