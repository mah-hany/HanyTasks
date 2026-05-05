"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'error' }]
        : [{ emit: 'event', level: 'error' }],
});
prisma.$on('error', (e) => {
    logger_1.logger.error('Prisma error:', e);
});
exports.default = prisma;
//# sourceMappingURL=client.js.map