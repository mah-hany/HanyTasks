import TelegramBot from 'node-telegram-bot-api';
import { Request, Response } from 'express';
/** Called from app.ts to register the webhook route */
export declare function getTelegramBot(): TelegramBot | null;
/** Send a message to a specific user */
export declare function sendTelegramNotification(userId: number, text: string): Promise<void>;
export declare function initTelegramBot(): Promise<void>;
/** Express route handler — called from app.ts for POST /api/telegram/webhook */
export declare function handleTelegramWebhook(req: Request, res: Response): void;
//# sourceMappingURL=telegram.bot.d.ts.map