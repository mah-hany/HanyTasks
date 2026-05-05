"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = requestLogger;
const logger_1 = require("../utils/logger");
function requestLogger(req, _res, next) {
    logger_1.logger.debug(`${req.method} ${req.path} — ${req.ip}`);
    next();
}
//# sourceMappingURL=requestLogger.js.map