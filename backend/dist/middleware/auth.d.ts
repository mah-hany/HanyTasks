import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: number;
        username: string;
        roleId: number;
        roleName: string;
        roleLevel: number;
    };
}
export declare function authenticate(req: AuthRequest, _res: Response, next: NextFunction): Promise<void>;
export declare function authorize(...allowedRoles: string[]): (req: AuthRequest, _res: Response, next: NextFunction) => void;
export declare function authorizeLevel(maxLevel: number): (req: AuthRequest, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map