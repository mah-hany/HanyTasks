"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = __importDefault(require("./app"));
const http_1 = require("http");
const socket_1 = require("./socket");
const logger_1 = require("./utils/logger");
const schedulers_1 = require("./schedulers");
const telegram_bot_1 = require("./modules/telegram/telegram.bot");
const client_1 = __importDefault(require("./prisma/client"));
const PORT = process.env.PORT || 5000;
async function bootstrap() {
    try {
        // Test DB connection
        await client_1.default.$connect();
        logger_1.logger.info('✅ Database connected successfully');
        const httpServer = (0, http_1.createServer)(app_1.default);
        (0, socket_1.initSocket)(httpServer);
        (0, schedulers_1.startSchedulers)();
        (0, telegram_bot_1.initTelegramBot)();
        httpServer.listen(PORT, () => {
            logger_1.logger.info(`🚀 TaskFlow Pro API running on port ${PORT}`);
            logger_1.logger.info(`📡 Environment: ${process.env.NODE_ENV}`);
        });
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=index.js.map