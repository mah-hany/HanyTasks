import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import multer from 'multer';
export declare const uploadAvatar: multer.Multer;
export declare const userController: {
    getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
    getById(req: Request, res: Response, next: NextFunction): Promise<void>;
    create(req: Request, res: Response, next: NextFunction): Promise<void>;
    update(req: Request, res: Response, next: NextFunction): Promise<void>;
    resetPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
    transfer(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getOrgTree(_req: Request, res: Response, next: NextFunction): Promise<void>;
    uploadPhoto(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getCredentials(_req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=user.controller.d.ts.map