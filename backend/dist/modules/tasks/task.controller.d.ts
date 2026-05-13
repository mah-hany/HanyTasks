import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import multer from 'multer';
export declare const uploadAttachment: multer.Multer;
export declare const taskController: {
    getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getById(req: Request, res: Response, next: NextFunction): Promise<void>;
    create(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    update(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    archive(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    addComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    addAttachment(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    deleteAttachment(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getCalendar(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getCategories(_req: Request, res: Response, next: NextFunction): Promise<void>;
    delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=task.controller.d.ts.map