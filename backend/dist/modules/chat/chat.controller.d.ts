import { Request, Response } from 'express';
export declare function getConversations(req: Request, res: Response): Promise<void>;
export declare function getMessages(req: Request, res: Response): Promise<void>;
export declare function sendMessage(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getChatUsers(req: Request, res: Response): Promise<void>;
export declare function getUnreadCount(req: Request, res: Response): Promise<void>;
export declare function createGroup(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getGroupMessages(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function sendGroupMessage(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=chat.controller.d.ts.map