"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
exports.authorizeLevel = authorizeLevel;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorHandler_1 = require("./errorHandler");
const client_1 = __importDefault(require("../prisma/client"));
async function authenticate(req, _res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new errorHandler_1.AppError('No token provided', 401);
        }
        const token = authHeader.split(' ')[1];
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await client_1.default.user.findUnique({
            where: { id: payload.sub },
            include: { role: true },
        });
        if (!user || !user.isActive) {
            throw new errorHandler_1.AppError('User not found or inactive', 401);
        }
        req.user = {
            id: user.id,
            username: user.username,
            roleId: user.roleId,
            roleName: user.role.name,
            roleLevel: user.role.level,
        };
        next();
    }
    catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            next(new errorHandler_1.AppError('Invalid or expired token', 401));
        }
        else {
            next(error);
        }
    }
}
// Role-based authorization
function authorize(...allowedRoles) {
    return (req, _res, next) => {
        if (!req.user)
            return next(new errorHandler_1.AppError('Unauthorized', 401));
        if (!allowedRoles.includes(req.user.roleName)) {
            return next(new errorHandler_1.AppError('Forbidden: insufficient permissions', 403));
        }
        next();
    };
}
// Level-based authorization (e.g., level <= 3 means SUPERADMIN, ADMIN, MANAGER)
function authorizeLevel(maxLevel) {
    return (req, _res, next) => {
        if (!req.user)
            return next(new errorHandler_1.AppError('Unauthorized', 401));
        if (req.user.roleLevel > maxLevel) {
            return next(new errorHandler_1.AppError('Forbidden: insufficient permissions', 403));
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map