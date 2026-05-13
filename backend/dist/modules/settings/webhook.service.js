"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookService = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const client_1 = __importDefault(require("../../prisma/client"));
const logger_1 = require("../../utils/logger");
exports.webhookService = {
    async dispatch(eventType, payload) {
        try {
            const hooks = await client_1.default.webhook.findMany({
                where: { isActive: true }
            });
            const matchedHooks = hooks.filter(h => h.eventTypes.includes(eventType) || h.eventTypes.includes('ALL'));
            if (matchedHooks.length === 0)
                return;
            const dataString = JSON.stringify({
                event: eventType,
                timestamp: new Date().toISOString(),
                data: payload
            });
            for (const hook of matchedHooks) {
                const headers = { 'Content-Type': 'application/json' };
                if (hook.secret) {
                    const signature = crypto_1.default.createHmac('sha256', hook.secret).update(dataString).digest('hex');
                    headers['X-Webhook-Signature'] = signature;
                }
                // Fire and forget
                axios_1.default.post(hook.url, dataString, { headers, timeout: 5000 }).catch((err) => {
                    logger_1.logger.warn(`Webhook failed for URL ${hook.url}: ${err.message}`);
                });
            }
        }
        catch (err) {
            logger_1.logger.error('Webhook dispatch error:', err);
        }
    }
};
//# sourceMappingURL=webhook.service.js.map