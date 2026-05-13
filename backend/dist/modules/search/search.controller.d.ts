import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare const searchController: {
    globalSearch(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
};
//# sourceMappingURL=search.controller.d.ts.map